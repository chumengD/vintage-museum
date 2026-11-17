"""对当前本地数据做离线校验，不访问网络，也不写数据库。"""
import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--deps', help='可选的Python依赖目录')
args = parser.parse_args()
if args.deps:
    sys.path.insert(0,args.deps)
from PIL import Image

root = Path(__file__).resolve().parents[1]
load = lambda name: json.loads((root/name).read_text(encoding='utf-8'))
catalog = load('catalog.json')
products, versions, assets, sources = [catalog[k] for k in ['products','versions','assets','sources']]
product_ids = {p['id'] for p in products}
version_ids = {v['id'] for v in versions}
asset_by_id = {a['id']:a for a in assets}
source_ids = {s['id'] for s in sources}
assert len(product_ids)==len(products)==3
assert len(version_ids)==len(versions)==37
assert len(asset_by_id)==len(assets)
assert len(source_ids)==len(sources)
assert Counter(v['productId'] for v in versions)=={'qq':12,'wechat':10,'windows':15}

for version in versions:
    assert version['productId'] in product_ids
    assert set(version['sourceIds']) <= source_ids
    assert set(version['assetIds']) <= asset_by_id.keys()
    if version['releasedAt']:
        assert date.fromisoformat(version['releasedAt']).year == version['timelineYear']
    else:
        assert version['datePrecision']=='unknown'
        assert version['timelineYearBasis']=='version_name_year'
    for asset_id in version['assetIds']:
        assert asset_by_id[asset_id]['versionId']==version['id']
        assert asset_by_id[asset_id]['role']=='version_screenshot'
    assert version['publicationStatus']=='draft'

for asset in assets:
    assert asset['sourceId'] in source_ids
    assert asset['productId'] in product_ids
    if asset['versionId']:
        assert asset['versionId'] in version_ids
    file = (root/asset['localPath']).resolve()
    assert file.is_relative_to(root)
    assert file.is_file() and file.stat().st_size==asset['bytes']
    assert hashlib.sha256(file.read_bytes()).hexdigest()==asset['sha256']
    source_sha1 = asset.get('sourceFileSha1')
    if source_sha1 and re.fullmatch(r'[a-f0-9]{40}',source_sha1):
        assert hashlib.sha1(file.read_bytes()).hexdigest()==source_sha1
    assert asset['safeToAutoPublish'] is False
    assert asset['publicationStatus']=='review_required'
    if asset['mimeType']!='image/svg+xml':
        with Image.open(file) as image:
            assert image.size==(asset['width'],asset['height'])
            assert min(image.size)>=96
            image.verify()
    else:
        assert not re.search(br'<(?:script|foreignObject)\b|\bonload\s*=',file.read_bytes(),re.I)
asset_files = {str(p.relative_to(root)).replace('\\','/') for p in (root/'assets').rglob('*') if p.is_file()}
assert asset_files == {a['localPath'] for a in assets}, '图片目录包含未登记文件或缺失文件'
for p in products:
    assert set(p['versionIds']) == {v['id'] for v in versions if v['productId']==p['id']}
    assert all(asset_by_id[a]['role']=='brand_logo' and asset_by_id[a]['versionId'] is None for a in p['logoAssetIds'])

official = load('wechat-official-releases.json')['releases']
assert len(official)>400
assert len({r['id'] for r in official})==len(official)
assert all(date.fromisoformat(r['releasedAt']) <= date.fromisoformat(catalog['collectedOn']) for r in official)
for v in versions:
    if v['productId']=='wechat':
        record = next(r for r in official if r['id']==v['officialIndexId'])
        assert record['platform']=='ios' and record['releasedAt']==v['releasedAt']
assert [json.loads(line) for line in (root/'versions.jsonl').read_text(encoding='utf-8').splitlines()] == versions
for filename,key in [('products.json','products'),('versions.json','versions'),('assets.json','assets'),('sources.json','sources')]:
    assert load(filename)==catalog[key]
report = load('collection-report.json')
assert report['assetCount']==len(assets)
assert report['curatedVersionCount']==len(versions)
assert report['officialWechatIndexCount']==len(official)
print(json.dumps({'result':'PASS','products':len(products),'curatedVersions':len(versions),'wechatOfficialIndex':len(official),'validLocalImages':len(assets),'sourceRecords':len(sources)},ensure_ascii=False))
