"""采集公开版本索引及参考图。只下载图片；不下载或运行软件安装包。"""
import argparse
import hashlib
import io
import json
import mimetypes
import re
import sys
import time
from collections import Counter
from datetime import date
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

parser = argparse.ArgumentParser()
parser.add_argument('--deps', help='可选的 Python 依赖目录，不修改系统环境')
parser.add_argument('--replace-generated', action='store_true', help='明确允许重采集并替换生成的数据；不会改业务代码')
parser.add_argument('--collected-on', help='采集日期YYYY-MM-DD；省略时使用本机日期')
parser.add_argument('--resume-partial', action='store_true', help='复用同一资料快照先前尝试已保存的图片和Wiki元数据')
args = parser.parse_args()
if args.deps:
    sys.path.insert(0, args.deps)
import requests
from bs4 import BeautifulSoup
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPEC = json.loads((ROOT / 'curated-spec.json').read_text(encoding='utf-8'))
COLLECTED = args.collected_on or date.today().isoformat()
date.fromisoformat(COLLECTED)
UA = 'VintageMuseumResearch/0.1 (educational history catalog; citations retained)'
if (ROOT / 'catalog.json').exists() and not args.replace_generated:
    raise SystemExit('已有数据包；保留原文件。需重采集时显式加 --replace-generated。')

sources, assets, versions, failures, warnings = {}, [], [], [], []
html_cache = {}
allowed_media_hosts = {'upload.wikimedia.org', 'thumb.wikimedia.org', 'n.sinaimg.cn', 'img1.mydrivers.com', 'img.jiemian.com'}
next_wiki_request = 0.0
http = requests.Session()
http.headers['User-Agent'] = UA

def save(name, value):
    path = ROOT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def fetch(url, params=None):
    global next_wiki_request
    wiki_host = urlsplit(url).hostname in {'en.wikipedia.org','zh.wikipedia.org','commons.wikimedia.org'}
    for attempt in range(3):
        if wiki_host:
            time.sleep(max(0, next_wiki_request-time.monotonic()))
            next_wiki_request = time.monotonic()+1.5
        try:
            r = http.get(url, params=params, timeout=(8, 25))
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as exc:
            if 'CERTIFICATE_VERIFY_FAILED' in str(exc) or attempt==2:
                raise
            time.sleep(2*(attempt+1))
            continue
        if r.status_code == 429 and attempt < 2:
            retry = r.headers.get('Retry-After','60')
            delay = int(retry) if retry.isdigit() else 60
            if delay > 60:
                r.raise_for_status()
            print('RATE LIMIT; honoring Retry-After:',delay,'seconds',flush=True)
            time.sleep(max(delay,1))
            continue
        r.raise_for_status()
        return r

def source(source_id, url, kind, title=None):
    if source_id in html_cache:
        return html_cache[source_id]
    r = fetch(url)
    soup = BeautifulSoup(r.content, 'html.parser')
    sources[source_id] = {
        'id': source_id, 'url': url, 'resolvedUrl': r.url, 'kind': kind,
        'title': title or (soup.title.get_text(' ', strip=True) if soup.title else url),
        'collectedOn': COLLECTED, 'httpStatus': r.status_code,
        'bodySha256': hashlib.sha256(r.content).hexdigest(),
        'note': 'source kind 不以网站域名推定；社区转载不是厂商官方发布。',
    }
    html_cache[source_id] = soup
    return soup

def plain(value):
    return BeautifulSoup(value or '', 'html.parser').get_text(' ', strip=True)

def image_asset(asset_id, url, source_id, role, product_id, version_id=None, caption='', wiki_info=None):
    try:
        url = urljoin(sources[source_id]['url'], url)
        parts = urlsplit(url)
        if parts.scheme != 'https' or parts.hostname not in allowed_media_hosts:
            raise ValueError('非允许的公开图片来源，停止下载：' + url)
        recovered = None
        candidates = list((ROOT/'assets/reference-only').glob(asset_id+'.*')) if args.resume_partial else []
        for candidate in candidates:
            try:
                with Image.open(candidate) as old_image:
                    if min(old_image.size)>=96:
                        recovered = candidate
                        break
            except Exception:
                pass
        if recovered:
            data = recovered.read_bytes()
            content_type = mimetypes.guess_type(recovered.name)[0]
        else:
            r = fetch(url)
            data = r.content
            content_type = r.headers.get('Content-Type', '').split(';')[0].strip().lower()
        if content_type not in {'image/png','image/jpeg','image/webp','image/gif','image/svg+xml'}:
            raise ValueError('响应不是允许的图片类型：' + content_type)
        if len(data)>10*1024*1024:
            raise ValueError('图片超过10MB上限')
        if content_type == 'image/svg+xml':
            if re.search(br'<(?:script|foreignObject)\b|\bonload\s*=', data, re.I):
                raise ValueError('SVG包含活动内容，不保存')
            suffix, width, height = '.svg', None, None
        else:
            with Image.open(io.BytesIO(data)) as image:
                image.verify()
            with Image.open(io.BytesIO(data)) as image:
                width, height = image.size
                suffix = {'PNG':'.png','JPEG':'.jpg','WEBP':'.webp','GIF':'.gif'}[image.format]
            if width < 96 or height < 96:
                raise ValueError(f'拒绝空白占位图或过小图片：{width}x{height}')
        local = 'assets/reference-only/' + asset_id + suffix
        path = ROOT / local
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        metadata = (wiki_info or {}).get('extmetadata', {})
        get_meta = lambda key: plain(metadata.get(key, {}).get('value')) or None
        asset = {
            'id': asset_id, 'productId': product_id, 'versionId': version_id,
            'role': role, 'localPath': local, 'caption': caption,
            'sourceId': source_id, 'downloadUrl': url, 'collectedOn': COLLECTED,
            'mimeType': content_type, 'width': width, 'height': height, 'bytes': len(data),
            'sha256': hashlib.sha256(data).hexdigest(),
            'downloadMethod':'recovered_same_snapshot_partial_download' if recovered else 'http_download',
            'licenseName': get_meta('LicenseShortName') or '未取得明确再发布许可',
            'licenseUrl': get_meta('LicenseUrl'), 'creator': get_meta('Artist'),
            'credit': get_meta('Credit'), 'restrictions': get_meta('Restrictions'),
            'copyrighted': get_meta('Copyrighted'),
            'publicationStatus': 'review_required', 'safeToAutoPublish': False,
            'matchNote': ('产品级Logo，不代表任何历史版本外观。' if role == 'brand_logo' else
                          '只匹配主版本/来源图注；不能据此推定补丁号、语言、地区或正式版构建。'),
        }
        if wiki_info:
            asset['fileDescriptionUrl'] = wiki_info.get('descriptionurl')
            asset['sourceFileTimestamp'] = wiki_info.get('timestamp')
            asset['sourceFileSha1'] = wiki_info.get('sha1')
        assets.append(asset)
        print('IMAGE', asset_id, width, height, flush=True)
        return asset_id
    except Exception as exc:
        # 保留此前失败尝试产生的占位图，但移出有效素材目录，避免被误导入。
        for candidate in (ROOT/'assets/reference-only').glob(asset_id+'.*'):
            try:
                with Image.open(candidate) as old_image:
                    tiny = min(old_image.size)<96
                if tiny and candidate.resolve().is_relative_to(ROOT):
                    rejected = ROOT/'provenance/rejected-downloads'/candidate.name
                    rejected.parent.mkdir(parents=True,exist_ok=True)
                    candidate.rename(rejected)
            except Exception:
                pass
        failures.append({'stage':'image', 'id':asset_id, 'url':url, 'error':str(exc)[:400]})
        print('IMAGE SKIP', asset_id, str(exc)[:100], flush=True)
        return None

def wiki_asset(asset_id, file_title, wiki_base, source_id, role, product_id, version_id=None, caption=''):
    try:
        cache = ROOT/'provenance/image-info'/(asset_id+'.json')
        response = json.loads(cache.read_text(encoding='utf-8')) if args.resume_partial and cache.exists() else fetch(wiki_base + '/w/api.php', {
            'action':'query','format':'json','formatversion':2,'titles':file_title,
            'prop':'imageinfo','iiprop':'url|size|sha1|timestamp|extmetadata',
        }).json()
        pages = response.get('query', {}).get('pages', [])
        info = next(p['imageinfo'][0] for p in pages if p.get('imageinfo'))
        save('provenance/image-info/' + asset_id + '.json', response)
        return image_asset(asset_id, info['url'], source_id, role, product_id, version_id, caption, info)
    except Exception as exc:
        failures.append({'stage':'wiki_image_info','id':asset_id,'error':str(exc)[:400]})
        return None

def version_base(version_id, product_id, version_name, platform, released_at, year, date_kind, summary, source_ids):
    return {
        'id':version_id,'productId':product_id,'version':version_name,'platform':platform,
        'title': ('Windows ' if product_id == 'windows' else '微信 ' if product_id == 'wechat' else '') + version_name,
        'timelineYear':year,'releasedAt':released_at,
        'datePrecision':'day' if released_at else 'unknown','dateKind':date_kind,
        'summary':summary,'summaryType':'editorial_paraphrase', 'sourceIds':source_ids,
        'assetIds':[], 'publicationStatus':'draft',
    }

# 1. 官方版本列表：只提取可见的版本号、日期、平台；绝不把当前选中的更新说明套给所有旧版本。
wechat_url = 'https://weixin.qq.com/cgi-bin/readtemplate?lang=zh_CN&t=weixin_faq_list'
wechat = source('wechat-official-index', wechat_url, 'official', '微信官网历史版本列表')
official = []
for heading in wechat.find_all('h3'):
    section = heading.find_parent(class_='faq_list_section')
    if not section:
        continue
    platform_label = heading.get_text(' ', strip=True)
    platform_key = section.get('id') or platform_label
    for li in section.select('.faq_section_sublist_item'):
        label_node = li.select_one('.version')
        text = li.get_text(' ', strip=True)
        match = re.search(r'\((\d{4}-\d{1,2}-\d{1,2})\)\s*$', text)
        if not label_node or not match:
            warnings.append({'kind':'unparsed_official_row','text':text[:150]})
            continue
        label = label_node.get_text(' ', strip=True)
        source_date = match.group(1)
        yy, mm, dd = map(int,source_date.split('-'))
        released = f'{yy:04d}-{mm:02d}-{dd:02d}'
        date.fromisoformat(released)
        identity = platform_key + '|' + label + '|' + released
        official.append({
            'id':'wechat-index-' + hashlib.sha256(identity.encode()).hexdigest()[:16],
            'productId':'wechat','platform':platform_key,'platformLabel':platform_label,
            'versionLabel':label,'releasedAt':released,'datePrecision':'day',
            'dateKind':'official_index_date','sourceId':'wechat-official-index',
            'sourceUrl':wechat_url,'sourceRowText':text,'sourceDateText':source_date,'collectedOn':COLLECTED,
            'changelog':None,'note':'仅为官网日期索引，不宣称所有地区或应用商店同日上线。',
        })
if len(official) < 100:
    raise RuntimeError('官网页面结构可能变化，索引过少，停止生成。')
official.sort(key=lambda row:(row['platform'],row['releasedAt'],row['versionLabel']))
duplicate_labels = Counter((x['platform'],x['versionLabel']) for x in official)
for key, count in duplicate_labels.items():
    if count > 1:
        warnings.append({'kind':'same_platform_version_multiple_dates', 'platform':key[0], 'versionLabel':key[1], 'count':count,
                         'note':'原样保留，不自动合并；可能存在客户端分支或源站编排差异。'})
save('wechat-official-releases.json', {'collectedOn':COLLECTED,'sourceId':'wechat-official-index','releases':official})
print('WECHAT INDEX',len(official),flush=True)

# 2. QQ 年号仅作为展览排序年份，绝不虚构1月1日发布日期。
qq_url = 'https://tech.sina.com.cn/csj/2019-02-11/doc-ihqfskcp4201086.shtml'
qq_page = source('qq-retro-sina', qq_url, 'authored_historical_review', '兰军 BLUES：QQ20岁版本回顾（新浪转载）')
source('qq-retro-community','https://developer.cloud.tencent.com/article/1088789','community_reprint','腾讯大讲堂社区转载：QQ15周年回顾')
sources['qq-first-beta'] = {'id':'qq-first-beta','url':'https://static.www.tencent.com/uploads/2019/12/18/bc6ee143861486379b1d78bf1393d3bc.pdf',
    'title':'腾讯时代：OICQ Beta1 诞生时间','kind':'official_document','collectedOn':COLLECTED,
    'verificationMethod':'web_search_document_excerpt','evidence':'1999年2月10日晚，OICQ Beta1诞生。'}
for row in SPEC['qq']:
    refs = ['qq-retro-sina','qq-retro-community'] + (['qq-first-beta'] if row['releasedAt'] else [])
    v = version_base(row['id'],'qq',row['version'],'Windows',row['releasedAt'],row['timelineYear'],
                     row.get('dateKind','unknown'),row['summary'],refs)
    v['timelineYearBasis'] = 'release_date' if row['releasedAt'] else 'version_name_year'
    v['dateNote'] = '首个公开测试版本日期。' if row['releasedAt'] else '年号来自版本名称；尚未确认首发日期，不是该年1月1日。'
    versions.append(v)
qq_main = qq_page.select_one('#artibody')
reviewed_rules = json.loads((ROOT/'reviewed-image-rules.json').read_text(encoding='utf-8'))
source_image_urls = {urljoin(qq_url,img.get('src','')) for img in qq_main.find_all('img')} if qq_main else set()
for rule in reviewed_rules['qq']:
    if rule['url'] not in source_image_urls:
        warnings.append({'kind':'reviewed_image_missing_from_source','id':rule['id']})
        continue
    asset_id = image_asset(rule['id'],rule['url'],'qq-retro-sina',rule['role'],'qq',rule['versionId'],rule['caption'])
    if asset_id:
        assets[-1]['visualReview'] = {'reviewedOn':reviewed_rules['reviewedOn'],'observedVersion':rule['observedVersion'],
                                    'sourceAlt':rule.get('sourceAlt'),'method':'manual_view_visible_window_title_or_unassigned'}
        assets[-1]['privacyReviewRequired'] = True
        if rule['versionId']:
            next(v for v in versions if v['id']==rule['versionId'])['assetIds'].append(asset_id)

# 功能摘要的补充来源与截图来源；厂商发布索引负责日期，不凭媒体发稿日冒充发布日期。
source('wechat-retro-features','https://developer.cloud.tencent.com/article/1042732','community_reprint','微信朋友圈四周年回顾')
source('wechat-6-review','https://news.mydrivers.com/1/323/323132.htm','release_report','快科技：iOS微信6.0发布')
source('wechat-7-review','https://www.ithome.com/0/401/790.htm','release_report','IT之家：iOS微信7.0发布')
source('wechat-8-review','https://www.jiemian.com/article/5580728.html','release_report','界面新闻：微信8.0体验')
sources['wechat-early-review'] = {'id':'wechat-early-review','url':'https://media.people.com.cn/n/2014/0606/c14677-25115651.html',
    'title':'人民网：微信发展大事记','kind':'historical_news_review','collectedOn':COLLECTED,
    'verificationMethod':'web_search_excerpt','note':'本机HTTPS证书校验失败，未关闭TLS验证；用于早期版本功能交叉查证，日期以微信官网为准。'}
for row in SPEC['wechatIos']:
    matches = [r for r in official if r['platform']=='ios' and r['versionLabel']==row['officialVersionLabel']]
    if len(matches)!=1:
        raise RuntimeError('iOS官方版本未唯一匹配：' + row['officialVersionLabel'])
    item = matches[0]
    feature_ref = {'6.0':'wechat-6-review','7.0.0':'wechat-7-review','8.0.0':'wechat-8-review','4.0':'wechat-retro-features'}.get(item['versionLabel'],'wechat-early-review')
    v = version_base(row['id'],'wechat',item['versionLabel'],'iOS',item['releasedAt'],int(item['releasedAt'][:4]),
                     'official_index_date',row['summary'],['wechat-official-index',feature_ref])
    v['officialIndexId'] = item['id']
    v['dateNote'] = '日期直接取iOS官方版本列表；不是Android等其他平台的发布日期。'
    versions.append(v)
wechat6 = html_cache['wechat-6-review'].select_one('.news_info')
for i, image in enumerate((wechat6.find_all('img') if wechat6 else [])[:3],1):
    anchor = image.find_parent('a')
    original_url = anchor.get('href') if anchor and anchor.get('href') else image.get('src')
    asset_id = image_asset(f'wechat-ios-6-0-screen-{i}', original_url, 'wechat-6-review','version_screenshot','wechat',
                           'wechat-ios-6-0','微信iOS 6.0发布报道配图，具体页面见图片，未取得再发布授权。')
    if asset_id:
        next(v for v in versions if v['id']=='wechat-ios-6-0')['assetIds'].append(asset_id)
wechat8 = html_cache['wechat-8-review'].select_one('.article-content')
static_images = [image for image in wechat8.find_all('img') if re.search(r'\.(jpe?g|png)(?:\?|$)',image.get('src',''),re.I)] if wechat8 else []
for i, image in enumerate(static_images[:3],1):
    role = 'editorial_photo' if i==1 else 'version_screenshot'
    version_id = None if i==1 else 'wechat-ios-8-0-0'
    caption = '微信主题装饰配图，不是8.0界面截图。' if i==1 else '微信8.0状态界面参考图。' if i==2 else '微信8.0图片操作菜单参考图。'
    asset_id = image_asset(f'wechat-ios-8-0-screen-{i}',image.get('src'),'wechat-8-review',role,'wechat',version_id,caption)
    if asset_id and version_id:
        next(v for v in versions if v['id']=='wechat-ios-8-0-0')['assetIds'].append(asset_id)

# 3. Windows 展览按公开发行日期排序；不把RTM日期混成零售日期。
source('windows-version-list','https://en.wikipedia.org/wiki/List_of_Microsoft_Windows_versions','wiki','Wikipedia Windows版本列表')
source('windows-official-timeline','https://news.microsoft.com/microsoft-50/','official','Microsoft 50周年时间线')
revision_cache = ROOT/'provenance/windows-revisions.json'
revision_batch = json.loads(revision_cache.read_text(encoding='utf-8')) if args.resume_partial and revision_cache.exists() else fetch('https://en.wikipedia.org/w/api.php', {'action':'query','format':'json','formatversion':2,
    'titles':'|'.join(row['wikiTitle'] for row in SPEC['windows']),'redirects':1,'prop':'revisions','rvprop':'ids|timestamp'}).json()
save('provenance/windows-revisions.json',revision_batch)
revision_pages = {p['title']:p for p in revision_batch['query']['pages']}
for row in SPEC['windows']:
    source_id = row['id']+'-wiki'
    url = 'https://en.wikipedia.org/wiki/' + row['wikiTitle'].replace(' ','_')
    try:
        page = source(source_id,url,'wiki')
        infobox = page.select_one('table.infobox')
    except Exception as exc:
        page, infobox = None, None
        sources[source_id] = {'id':source_id,'url':url,'kind':'wiki','title':row['wikiTitle'],'collectedOn':COLLECTED,'fetchStatus':'failed'}
        failures.append({'stage':'source','id':source_id,'url':url,'error':str(exc)[:400]})
    release_rows = []
    for tr in infobox.find_all('tr') if infobox else []:
        th = tr.find('th')
        if th and re.search(r'general availability|initial release|released|release date', th.get_text(' ',strip=True),re.I):
            release_rows.append(tr.get_text(' ',strip=True)[:500])
    sources[source_id]['dateEvidence'] = release_rows
    expected_date = date.fromisoformat(row['releasedAt'])
    display_date = expected_date.strftime('%B')+' '+str(expected_date.day)+', '+str(expected_date.year)
    sources[source_id]['dateEvidenceMatchesExpected'] = any(row['releasedAt'] in text or display_date in text for text in release_rows)
    if not sources[source_id]['dateEvidenceMatchesExpected']:
        warnings.append({'kind':'date_needs_review','versionId':row['id'],'expected':row['releasedAt'],'evidence':release_rows})
    canonical_title = page.select_one('#firstHeading').get_text(' ',strip=True) if page else row['wikiTitle']
    wiki_page = revision_pages.get(canonical_title) or revision_pages[row['wikiTitle']]
    rev = wiki_page['revisions'][0]
    sources[source_id]['revisionId'] = rev['revid']
    sources[source_id]['permalink'] = 'https://en.wikipedia.org/w/index.php?oldid='+str(rev['revid'])
    v = version_base(row['id'],'windows',row['version'],'PC',row['releasedAt'],int(row['releasedAt'][:4]),
                     'public_release',row['summary'],[source_id,'windows-version-list'])
    if row['id'] in {'windows-95','windows-xp'}:
        v['sourceIds'].append('windows-official-timeline')
    v['dateNote'] = '面向公众的发行日期；地区可能存在差异。1.x/2.x为系列节点，截图不保证是首个补丁版。'
    versions.append(v)
    screenshots = []
    for image in infobox.find_all('img') if infobox else []:
        a = image.find_parent('a')
        if not a:
            continue
        href = a.get('href','')
        if '/wiki/File:' not in href:
            continue
        title = unquote(href.split('/wiki/',1)[1])
        if title.lower().endswith(('.png','.jpg','.jpeg','.gif','.webp')) and not re.search('logo|wordmark|icon',title,re.I):
            screenshots.append(title)
    prior_image_info = ROOT/'provenance/image-info'/(row['id']+'-screenshot.json')
    if not screenshots and args.resume_partial and prior_image_info.exists():
        prior = json.loads(prior_image_info.read_text(encoding='utf-8'))
        screenshots = [p['title'] for p in prior.get('query',{}).get('pages',[]) if p.get('imageinfo')]
    if screenshots:
        asset_id = wiki_asset(row['id']+'-screenshot',screenshots[0],'https://en.wikipedia.org',source_id,
                              'version_screenshot','windows',row['id'],row['wikiTitle']+'信息框截图；语言和补丁版本以源图说明为准。')
        if asset_id:
            v['assetIds'].append(asset_id)
    print('WINDOWS',row['version'],v['assetIds'],flush=True)
    time.sleep(0.2)

# 通用Logo单独保存，不能拿它们冒充每个历史版本的截图。
source('wechat-wiki','https://en.wikipedia.org/wiki/WeChat','wiki')
wiki_asset('wechat-brand-logo','File:WeChat Logo.png','https://en.wikipedia.org','wechat-wiki','brand_logo','wechat',caption='通用微信Logo，不代表2011年或任意旧版本的Logo。')
source('qq-wiki','https://zh.wikipedia.org/wiki/腾讯QQ','wiki')
wiki_asset('qq-brand-logo','File:Tencent QQ.svg','https://zh.wikipedia.org','qq-wiki','brand_logo','qq',caption='维基百科所收录的QQ标识，不作为任意旧版本图标的佐证。')

for v in versions:
    if not v['assetIds']:
        v['imageStatus'] = 'missing_version_matched_image'
    else:
        v['imageStatus'] = 'reference_only_pending_rights_review'
versions.sort(key=lambda v:(v['productId'],v['timelineYear'],v['releasedAt'] or '',v['id']))
products = SPEC['products']
for p in products:
    p['versionIds'] = [v['id'] for v in versions if v['productId']==p['id']]
    p['logoAssetIds'] = [a['id'] for a in assets if a['productId']==p['id'] and a['role']=='brand_logo']
catalog = {'schemaVersion':'1.0.0','collectedOn':COLLECTED,
    'scope':'首批精选版本，不是完整更新日志；额外附带微信官网版本日期索引。',
    'products':products,'versions':versions,'assets':assets,'sources':list(sources.values())}
save('catalog.json',catalog)
for name,value in [('products',products),('versions',versions),('assets',assets),('sources',list(sources.values()))]:
    save(name+'.json',value)
(ROOT/'versions.jsonl').write_text(''.join(json.dumps(v,ensure_ascii=False)+'\n' for v in versions),encoding='utf-8')
report = {
    'collectedOn':COLLECTED,'productCount':len(products),'curatedVersionCount':len(versions),
    'curatedByProduct':dict(Counter(v['productId'] for v in versions)),
    'officialWechatIndexCount':len(official),'officialWechatPlatforms':dict(Counter(v['platformLabel'] for v in official)),
    'assetCount':len(assets),'assetBytes':sum(a['bytes'] for a in assets),
    'imageCoveredVersionCount':sum(bool(v['assetIds']) for v in versions),
    'sourceCount':len(sources),'safeToAutoPublishAssetCount':sum(a['safeToAutoPublish'] for a in assets),
    'warnings':warnings,'failures':failures,
    'missingVersionImages':[v['id'] for v in versions if not v['assetIds']],
}
save('collection-report.json',report)
print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
