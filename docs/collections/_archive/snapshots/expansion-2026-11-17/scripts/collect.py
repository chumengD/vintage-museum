"""可复跑的第二批博物馆资料采集：只抓公开页面和图片，不下载/执行安装包。

python scripts/collect.py --deps <optional dependency directory>
默认保留已有catalog；--replace-generated仅重建本目录的生成数据，不修改spec/rules。
"""
import argparse
import hashlib
import io
import json
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, unquote, urlparse

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--deps')
parser.add_argument('--metadata-only', action='store_true', help='只采集页面和候选图，供人工检查')
parser.add_argument('--replace-generated', action='store_true')
parser.add_argument('--offline', action='store_true', help='只使用快照缓存，不发网络请求；缺少的图片记为警告')
args = parser.parse_args()
if args.deps:
    sys.path.insert(0, args.deps)
import requests
from bs4 import BeautifulSoup
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPEC = json.loads((ROOT/'collection-spec.json').read_text(encoding='utf-8'))
CACHE = ROOT/'.cache'
CACHE.mkdir(exist_ok=True)
if (ROOT/'catalog.json').exists() and not args.replace_generated:
    raise FileExistsError('已有catalog，默认保留；如需重建请显式使用 --replace-generated')
local = threading.local()
errors = []
media_next_request = 0.0


def dump(relative, value):
    path = ROOT/relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


prior_report_path = ROOT/'collection-report.json'
if prior_report_path.exists():
    prior_data = prior_report_path.read_bytes()
    prior_hash = hashlib.sha256(prior_data).hexdigest()[:16]
    prior_path = ROOT/'provenance/collection-attempts'/f'{prior_hash}.json'
    if not prior_path.exists():
        dump(str(prior_path.relative_to(ROOT)),json.loads(prior_data))


def fetch(url, params=None):
    global media_next_request
    prepared = requests.Request('GET', url, params=params).prepare().url
    key = hashlib.sha256(prepared.encode()).hexdigest()
    content_path, meta_path = CACHE/(key+'.body'), CACHE/(key+'.json')
    if content_path.exists() and meta_path.exists():
        return content_path.read_bytes(), json.loads(meta_path.read_text(encoding='utf-8'))
    if args.offline:
        raise ValueError('离线模式下无成功缓存；历史限流原因见provenance/collection-attempts')
    if not hasattr(local, 'session'):
        local.session = requests.Session()
        local.session.headers['User-Agent'] = 'VintageMuseumResearch/0.2 (educational historical software catalog)'
    for attempt in range(3):
        try:
            if urlparse(url).hostname in {'upload.wikimedia.org','thumb.wikimedia.org'}:
                time.sleep(max(0,media_next_request-time.monotonic()))
                media_next_request = time.monotonic()+2.5
            response = local.session.get(url, params=params, timeout=(12, 40))
            if response.status_code == 429:
                retry = response.headers.get('Retry-After','60')
                delay = int(retry) if retry.isdigit() else 60
                if delay <= 60 and attempt < 2:
                    print('RATE LIMIT; honoring Retry-After:',delay,'seconds',flush=True)
                    time.sleep(max(delay,1))
                    continue
                raise RuntimeError('HTTP 429; Retry-After='+retry)
            response.raise_for_status()
            if len(response.content) > 12*1024*1024:
                raise ValueError('超过12MB采集大小上限')
            meta = {'requestedUrl':prepared, 'resolvedUrl':response.url,
                    'retrievedAt':datetime.now(timezone.utc).isoformat(),
                    'contentType':response.headers.get('Content-Type',''),
                    'sha256':hashlib.sha256(response.content).hexdigest(),
                    'bytes':len(response.content), 'httpStatus':response.status_code}
            content_path.write_bytes(response.content)
            meta_path.write_text(json.dumps(meta, ensure_ascii=False), encoding='utf-8')
            return response.content, meta
        except requests.exceptions.SSLError:
            raise  # 不关闭证书校验。
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            if attempt == 2:
                raise
            time.sleep(2*(attempt+1))


def text_of(value):
    if '<' not in (value or ''):
        return value or ''
    return BeautifulSoup(value or '', 'html.parser').get_text(' ', strip=True)


pages = []
for product in SPEC['products']:
    pages.append({'id':'wiki-'+product['id'], 'productId':product['id'],
                  'title':product['wikiTitle'], 'language':product['wikiLanguage'], 'versionId':None})
for version in SPEC['versions']:
    if 'wikiTitle' in version:
        pages.append({'id':'wiki-'+version['id'], 'productId':version['productId'],
                      'title':version['wikiTitle'], 'language':'en', 'versionId':version['id']})


def wiki_page(page):
    page = dict(page)
    url = 'https://'+page['language']+'.wikipedia.org/wiki/'+quote(page['title'].replace(' ','_'), safe='()_')
    try:
        body, meta = fetch(url)
        soup = BeautifulSoup(body, 'html.parser')
        heading = soup.select_one('#firstHeading')
        if not heading or not soup.select_one('.mw-parser-output'):
            raise ValueError('响应中没有Wiki正文，拒绝当作正常页面')
        canonical = heading.get_text(' ', strip=True)
        page.update({'url':url, 'canonicalTitle':canonical, 'fetch':meta})
        html_revision = re.search(rb'"wgRevisionId"\s*:\s*(\d+)',body)
        page['htmlRevisionId'] = int(html_revision[1]) if html_revision else None
        box = soup.select_one('.infobox')
        captions = []
        candidates = []
        if box:
            for cell in box.select('.infobox-image'):
                caption = cell.select_one('.infobox-caption')
                label = caption.get_text(' ', strip=True) if caption else ''
                for anchor in cell.select('a.mw-file-description'):
                    img = anchor.find('img')
                    href = unquote(anchor.get('href',''))
                    if img and 'File:' in href:
                        title = 'File:'+href.split('File:',1)[1].split('#')[0].split('?')[0]
                        label_full = label+' '+img.get('alt','')
                        # 仅作候选类型；reviewed-image-rules.json可覆盖或排除。
                        is_screen = bool(re.search(r'screenshot|screen shot|home.?screen|running|\d\.\d|屏幕|截图|界面',label_full+' '+title,re.I))
                        role = 'product_reference_screenshot' if is_screen else 'brand_logo'
                        if page['versionId'] and is_screen:
                            role = 'version_screenshot'
                        candidates.append({'productId':page['productId'], 'sourceId':page['id'],
                                           'wikiLanguage':page['language'], 'fileTitle':title,
                                           'caption':label, 'alt':img.get('alt',''),
                                           'role':role, 'versionId':page['versionId'] if role=='version_screenshot' else None})
                        captions.append(label)
        # 主页面正文的历史截图保留为候选，后续人工规则明确版本；不自动下载所有插图。
        if page['versionId'] is None:
            for figure in soup.select('figure'):
                label = figure.get_text(' ', strip=True)
                a = figure.select_one('a.mw-file-description')
                if a and re.search(r'Messenger (?:1\.0|8\.0)|Winamp 2|Firefox 1\.0',label,re.I):
                    href = unquote(a.get('href',''))
                    if 'File:' in href:
                        candidates.append({'productId':page['productId'],'sourceId':page['id'],
                            'wikiLanguage':page['language'],'fileTitle':'File:'+href.split('File:',1)[1].split('#')[0].split('?')[0],
                            'caption':label,'alt':'','role':'product_reference_screenshot','versionId':None})
        page['candidates'] = candidates
        page['evidence'] = {'canonicalTitle':canonical, 'htmlRevisionId':page['htmlRevisionId'],
                            'infoboxText':box.get_text(' ',strip=True)[:7000] if box else '',
                            'imageCaptions':captions}
        dump('provenance/pages/'+page['id']+'.json', {'fetch':meta, **page['evidence']})
        print('PAGE', page['id'], len(candidates), flush=True)
    except Exception as exc:
        page['error'] = str(exc)
        page['candidates'] = []
        errors.append({'stage':'page', 'id':page['id'], 'error':str(exc)})
        print('PAGE FAILED', page['id'], str(exc)[:160], flush=True)
    return page


pages = list(ThreadPoolExecutor(max_workers=2).map(wiki_page, pages))
sources = []
for page in pages:
    source = {'id':page['id'], 'kind':'wikipedia', 'url':page.get('url'),
              'title':page.get('canonicalTitle',page['title']), 'language':page['language'],
              'collectedOn':SPEC['collectedOn'], 'retrievalStatus':'failed' if page.get('error') else 'ok'}
    if 'fetch' in page:
        source.update({'retrievedAt':page['fetch']['retrievedAt'], 'htmlSha256':page['fetch']['sha256'],
                       'evidencePath':'provenance/pages/'+page['id']+'.json'})
        if page.get('htmlRevisionId'):
            source.update({'revisionId':page['htmlRevisionId'], 'revisionProvenance':'html_RLCONF',
                'permalink':'https://'+page['language']+'.wikipedia.org/w/index.php?oldid='+str(page['htmlRevisionId'])})
    sources.append(source)

official_html = {}
for item in SPEC['sources']:
    source = dict(item, collectedOn=SPEC['collectedOn'])
    try:
        body, meta = fetch(item['url'])
        official_html[item['id']] = body
        soup = BeautifulSoup(body, 'html.parser')
        # 留存标题和纯日期标记，不复制官网文章正文。
        document_title = soup.title.get_text(' ',strip=True) if soup.title else item['title']
        date_tokens = sorted(set(re.findall(r'\b(?:19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b',soup.get_text(' ',strip=True))))[:40]
        dump('provenance/pages/'+item['id']+'.json', {'fetch':meta,'documentTitle':document_title,'dateTokens':date_tokens})
        source.update({'retrievalStatus':'ok','retrievedAt':meta['retrievedAt'], 'htmlSha256':meta['sha256'],
                       'evidencePath':'provenance/pages/'+item['id']+'.json'})
        print('OFFICIAL',item['id'],flush=True)
    except Exception as exc:
        source.update({'retrievalStatus':'failed','error':str(exc)})
        errors.append({'stage':'official','id':item['id'],'error':str(exc)})
        print('OFFICIAL FAILED',item['id'],str(exc)[:120],flush=True)
    sources.append(source)

official_releases = []
if 'official-sogou-history' in official_html:
    soup = BeautifulSoup(official_html['official-sogou-history'],'html.parser')
    for heading in soup.find_all('h2'):
        line = heading.get_text(' ',strip=True)
        match = re.match(r'\s*(20\d\d)\.(\d{1,2})\.(\d{1,2})\s+(.+?)发布\s*$',line)
        if match:
            year,month,day,label = match.groups()
            label = re.sub(r'\s+','',label)
            official_releases.append({'id':'sogou-index-'+f'{int(year):04d}{int(month):02d}{int(day):02d}',
                'productId':'sogou-pinyin','platform':'windows','version':label,
                'releasedAt':f'{int(year):04d}-{int(month):02d}-{int(day):02d}',
                'sourceId':'official-sogou-history','sourceHeading':line})
    if len(official_releases) < 30:
        raise ValueError('搜狗历史页结构发生变化，解析数量异常')
dump('sogou-official-releases.json', {'collectedOn':SPEC['collectedOn'],'sourceUrl':'https://pinyin.sogou.com/updatelog.php','releases':official_releases})

versions = []
for row in SPEC['versions']:
    row = dict(row)
    row['sourceIds'] = row.pop('sources')
    row.setdefault('datePrecision','day' if row['releasedAt'] else 'year')
    row.setdefault('recordType','release')
    row.setdefault('dateKind','release')
    row.update({'assetIds':[],'publicationStatus':'draft'})
    row.pop('wikiTitle',None)
    versions.append(row)
for label in SPEC['sogouSelections']:
    matches = [r for r in official_releases if r['version']==label]
    if len(matches)!=1:
        raise ValueError('未唯一匹配搜狗版本：'+label)
    record = matches[0]
    versions.append({'id':'sogou-'+record['releasedAt'], 'productId':'sogou-pinyin','version':'搜狗拼音 '+label,
        'releasedAt':record['releasedAt'],'timelineYear':int(record['releasedAt'][:4]),'datePrecision':'day',
        'dateKind':'public_beta' if '公测' in label else 'stable_release','recordType':'release',
        'summary':'官方历史更新页中的'+label+'节点。', 'officialIndexId':record['id'],
        'sourceIds':['official-sogou-history','wiki-sogou-pinyin'],'assetIds':[],'publicationStatus':'draft'})

candidates = []
seen = set()
for page in pages:
    for item in page['candidates']:
        key = (item['sourceId'],item['fileTitle'])
        if key not in seen:
            seen.add(key)
            candidates.append(item)
dump('image-candidates.json',candidates)
dump('sources.json',sources)
if args.metadata_only:
    print(json.dumps({'pages':len(pages),'curatedVersions':len(versions),'sogouOfficialIndex':len(official_releases),
                      'imageCandidates':len(candidates),'errors':errors},ensure_ascii=False))
    raise SystemExit(0)

# 每种语言批量查询修订和图片元数据，避免对每张图发送一次API请求。
for language in sorted({p['language'] for p in pages}):
    titles = [p.get('canonicalTitle',p['title']) for p in pages if p['language']==language and not p.get('error')]
    if not titles:
        continue
    endpoint = 'https://'+language+'.wikipedia.org/w/api.php'
    try:
        data, meta = fetch(endpoint, {'action':'query','titles':'|'.join(titles),'redirects':1,'prop':'revisions',
                                      'rvprop':'ids|timestamp','format':'json','formatversion':2})
        revisions = json.loads(data)
        dump('provenance/wiki-revisions-'+language+'.json',{'fetch':meta,'response':revisions})
        for page in revisions.get('query',{}).get('pages',[]):
            revs = page.get('revisions',[])
            for source in sources:
                if source.get('language')==language and source['title'].lower()==page['title'].lower() and revs:
                    source.update({'apiRevisionId':revs[0]['revid'],'apiRevisionTimestamp':revs[0]['timestamp']})
                    if not source.get('revisionId'):
                        source.update({'revisionId':revs[0]['revid'],'revisionProvenance':'api_latest_not_html_verified',
                            'permalink':'https://'+language+'.wikipedia.org/w/index.php?oldid='+str(revs[0]['revid'])})
                    elif source['revisionId']==revs[0]['revid']:
                        source['revisionTimestamp'] = revs[0]['timestamp']
    except Exception as exc:
        errors.append({'stage':'revision_api','language':language,'error':str(exc)})
    time.sleep(1.5)

rules_path = ROOT/'reviewed-image-rules.json'
rules = json.loads(rules_path.read_text(encoding='utf-8')) if rules_path.exists() else []
for item in candidates:
    for rule in rules:
        if rule['fileTitle']==item['fileTitle'] and rule.get('sourceId',item['sourceId'])==item['sourceId']:
            item.update({k:v for k,v in rule.items() if k not in {'fileTitle','sourceId'}})

file_info = {}
for language in sorted({c['wikiLanguage'] for c in candidates}):
    titles = sorted({c['fileTitle'] for c in candidates if c['wikiLanguage']==language and not c.get('exclude')})
    for start in range(0,len(titles),40):
        try:
            data, meta = fetch('https://'+language+'.wikipedia.org/w/api.php', {'action':'query',
                'titles':'|'.join(titles[start:start+40]),'prop':'imageinfo','iiprop':'url|size|sha1|timestamp|extmetadata',
                'format':'json','formatversion':2,'redirects':1})
            response = json.loads(data)
            dump(f'provenance/image-info/{language}-{start//40}.json',{'fetch':meta,'response':response})
            infos = {p['title']:p['imageinfo'][0] for p in response.get('query',{}).get('pages',[]) if p.get('imageinfo')}
            normalized = {n['from']:n['to'] for n in response.get('query',{}).get('normalized',[])}
            redirects = {n['from']:n['to'] for n in response.get('query',{}).get('redirects',[])}
            for title in titles[start:start+40]:
                lookup = normalized.get(title,title)
                lookup = redirects.get(lookup,lookup)
                if lookup in infos:
                    file_info[(language,title)] = infos[lookup]
        except Exception as exc:
            errors.append({'stage':'image_api','language':language,'error':str(exc)})
        time.sleep(1.5)

assets = []
used_files = set()
for item in candidates:
    if item.get('exclude'):
        continue
    info = file_info.get((item['wikiLanguage'],item['fileTitle']))
    if not info:
        errors.append({'stage':'image_metadata_missing','fileTitle':item['fileTitle']})
        continue
    try:
        url = info['url']
        if urlparse(url).hostname not in {'upload.wikimedia.org','thumb.wikimedia.org'}:
            raise ValueError('图片主机不在允许列表')
        if info.get('size',0)>10*1024*1024:
            raise ValueError('图片超过10MB')
        data, meta = fetch(url)
        ext = Path(urlparse(url).path).suffix.lower()
        width,height = info.get('width'),info.get('height')
        if ext=='.svg':
            if b'<svg' not in data or re.search(br'<(?:script|foreignObject)\b|\bon\w+\s*=|(?:href|src)\s*=\s*[\x22\x27]https?://',data,re.I):
                raise ValueError('SVG含主动内容/外链或结构不合法')
            mime = 'image/svg+xml'
        else:
            with Image.open(io.BytesIO(data)) as image:
                width,height = image.size
                if min(width,height)<16 or max(width,height)<64:
                    raise ValueError('占位图或尺寸过小')
                if item['role'].endswith('screenshot') and min(width,height)<96:
                    raise ValueError('界面截图分辨率不足')
                mime = Image.MIME.get(image.format,'image/'+image.format.lower())
                ext = {'JPEG':'.jpg','PNG':'.png','GIF':'.gif','WEBP':'.webp'}.get(image.format,ext)
                image.verify()
        sha = hashlib.sha256(data).hexdigest()
        key = (item['productId'],sha,item['role'],item.get('versionId'))
        if key in used_files:
            continue
        used_files.add(key)
        relative = f"assets/reference-only/{item['productId']}-{sha[:12]}{ext}"
        path = ROOT/relative
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(data)
        extra = info.get('extmetadata',{})
        em = lambda name:text_of(extra.get(name,{}).get('value',''))
        asset = {'id':'asset-'+item['productId']+'-'+sha[:12], 'productId':item['productId'],
            'versionId':item.get('versionId'), 'role':item['role'], 'sourceId':item['sourceId'],
            'caption':item['caption'], 'matchNote':item.get('matchNote','仅按来源页面记录；产品参考图不代表任何早期发布版本。'),
            'wikiFileTitle':item['fileTitle'],'sourceUrl':url,'descriptionUrl':info.get('descriptionurl'),
            'localPath':relative,'mimeType':mime,'width':width,'height':height,'bytes':len(data),
            'sha256':sha,'sourceFileSha1':info.get('sha1'),'licenseName':em('LicenseShortName'),
            'licenseUrl':em('LicenseUrl'),'creator':em('Artist'),'credit':em('Credit'),
            'restrictions':em('Restrictions'),'copyrighted':em('Copyrighted'),
            'privacyReviewRequired':item['role'].endswith('screenshot'),
            'publicationStatus':'review_required','safeToAutoPublish':False,'collectedOn':SPEC['collectedOn']}
        assets.append(asset)
        print('IMAGE',item['fileTitle'],width,height,item.get('versionId'),flush=True)
    except Exception as exc:
        errors.append({'stage':'download_or_validation','fileTitle':item['fileTitle'],'error':str(exc)})
        print('IMAGE SKIP',item['fileTitle'],str(exc)[:140],flush=True)

for version in versions:
    version['assetIds'] = [a['id'] for a in assets if a['versionId']==version['id']]
products = []
for product in SPEC['products']:
    product = {k:v for k,v in product.items() if k not in {'wikiTitle','wikiLanguage'}}
    product.update({'versionIds':[v['id'] for v in versions if v['productId']==product['id']],
                    'logoAssetIds':[a['id'] for a in assets if a['productId']==product['id'] and a['role']=='brand_logo'],
                    'referenceAssetIds':[a['id'] for a in assets if a['productId']==product['id'] and a['versionId'] is None and a['role']!='brand_logo'],
                    'sourceIds':['wiki-'+product['id']], 'publicationStatus':'draft'})
    products.append(product)
catalog = {'schemaVersion':'1.0','collectedOn':SPEC['collectedOn'],'scope':'museum-expansion-10-products',
           'products':products,'versions':versions,'assets':assets,'sources':sources}
dump('catalog.json',catalog)
for filename,key in [('products.json','products'),('versions.json','versions'),('assets.json','assets'),('sources.json','sources')]:
    dump(filename,catalog[key])
(ROOT/'versions.jsonl').write_text(''.join(json.dumps(v,ensure_ascii=False)+'\n' for v in versions),encoding='utf-8')
report = {'collectedOn':SPEC['collectedOn'],'productCount':len(products),'curatedVersionCount':len(versions),
          'officialSogouIndexCount':len(official_releases),'assetCount':len(assets),'sourceCount':len(sources),
          'versionScreenshotCount':sum(a['role']=='version_screenshot' for a in assets),
          'versionsWithoutScreenshot':[v['id'] for v in versions if not v['assetIds']],
          'failedSourceCount':sum(s.get('retrievalStatus')=='failed' for s in sources),'issues':errors}
dump('collection-report.json',report)
print(json.dumps(report,ensure_ascii=False,indent=2))
