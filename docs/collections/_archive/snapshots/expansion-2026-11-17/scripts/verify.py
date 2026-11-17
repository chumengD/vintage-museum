"""第二批资料的离线一致性、引用、日期和图片完整性检查。"""
import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--deps')
args = parser.parse_args()
if args.deps:
    sys.path.insert(0,args.deps)
from PIL import Image

root = Path(__file__).resolve().parents[1]
load = lambda name:json.loads((root/name).read_text(encoding='utf-8'))
catalog = load('catalog.json')
products, versions, assets, sources = [catalog[key] for key in ('products','versions','assets','sources')]
product_map = {p['id']:p for p in products}
version_map = {v['id']:v for v in versions}
asset_map = {a['id']:a for a in assets}
source_map = {s['id']:s for s in sources}
assert len(product_map)==len(products)==10
assert len(version_map)==len(versions)==41
assert len(asset_map)==len(assets)
assert len(source_map)==len(sources)
assert Counter(v['productId'] for v in versions)=={'msn':4,'internet-explorer':3,'firefox':3,'chrome':2,
    'winamp':3,'windows-media-player':3,'sogou-pinyin':6,'thunder':6,'android':6,'ios':5}
collected = date.fromisoformat(catalog['collectedOn'])
for version in versions:
    assert version['productId'] in product_map
    assert version['publicationStatus']=='draft'
    assert set(version['sourceIds']) <= source_map.keys()
    assert set(version['assetIds']) <= asset_map.keys()
    if version['releasedAt']:
        released = date.fromisoformat(version['releasedAt'])
        assert released.year==version['timelineYear'] and released<=collected
        assert version['datePrecision']=='day'
    else:
        assert version['datePrecision']=='year'
        assert version['timelineYear'] <= collected.year
    for aid in version['assetIds']:
        asset = asset_map[aid]
        assert asset['versionId']==version['id'] and asset['productId']==version['productId']
        assert asset['role']=='version_screenshot'
for product in products:
    assert set(product['versionIds'])=={v['id'] for v in versions if v['productId']==product['id']}
    for aid in product['logoAssetIds']:
        assert asset_map[aid]['role']=='brand_logo' and asset_map[aid]['versionId'] is None
    for aid in product['referenceAssetIds']:
        assert asset_map[aid]['role']=='product_reference_screenshot' and asset_map[aid]['versionId'] is None
for asset in assets:
    assert asset['productId'] in product_map and asset['sourceId'] in source_map
    assert asset['publicationStatus']=='review_required' and asset['safeToAutoPublish'] is False
    assert asset['sourceUrl'].startswith('https://upload.wikimedia.org/')
    if asset['versionId']:
        assert asset['versionId'] in version_map
        assert asset['id'] in version_map[asset['versionId']]['assetIds']
    else:
        assert asset['role'] in {'brand_logo','product_reference_screenshot'}
    path = (root/asset['localPath']).resolve()
    assert path.is_relative_to(root) and path.is_file()
    data = path.read_bytes()
    assert len(data)==asset['bytes'] and hashlib.sha256(data).hexdigest()==asset['sha256']
    if asset.get('sourceFileSha1'):
        sha1 = asset['sourceFileSha1']
        if not re.fullmatch('[a-f0-9]{40}',sha1):
            sha1 = f'{int(sha1,36):040x}'
        assert hashlib.sha1(data).hexdigest()==sha1
    if asset['mimeType']=='image/svg+xml':
        assert b'<svg' in data
        assert not re.search(br'<(?:script|foreignObject)\b|\bon\w+\s*=',data,re.I)
    else:
        with Image.open(path) as image:
            assert image.size==(asset['width'],asset['height'])
            assert min(image.size)>=16 and max(image.size)>=64
            if asset['role'].endswith('screenshot'):
                assert min(image.size)>=96
            image.verify()
asset_files = {p.relative_to(root).as_posix() for p in (root/'assets').rglob('*') if p.is_file()}
assert asset_files=={a['localPath'] for a in assets}
for source in sources:
    assert source['retrievalStatus']=='ok'
    receipt = load(source['evidencePath'])
    assert source['htmlSha256']==receipt['fetch']['sha256']
    assert receipt['fetch']['httpStatus']==200
official = load('sogou-official-releases.json')['releases']
assert len(official)==len({r['id'] for r in official})==35
assert all(date.fromisoformat(r['releasedAt'])<=collected for r in official)
for version in versions:
    if version['productId']=='sogou-pinyin':
        match = next(r for r in official if r['id']==version['officialIndexId'])
        assert match['releasedAt']==version['releasedAt']
assert [json.loads(line) for line in (root/'versions.jsonl').read_text(encoding='utf-8').splitlines()]==versions
for filename,key in [('products.json','products'),('versions.json','versions'),('assets.json','assets'),('sources.json','sources')]:
    assert load(filename)==catalog[key]
report = load('collection-report.json')
assert report['assetCount']==len(assets) and report['curatedVersionCount']==len(versions)
assert report['officialSogouIndexCount']==35
assert report['sourceCount']==len(sources)
assert report['versionScreenshotCount']==sum(a['role']=='version_screenshot' for a in assets)
assert report['versionsWithoutScreenshot']==[v['id'] for v in versions if not v['assetIds']]
unexpected = [issue for issue in report['issues'] if issue['stage']!='download_or_validation']
assert not unexpected, '页面或元数据采集异常，需检查报告'
print(json.dumps({'result':'PASS','products':len(products),'curatedVersions':len(versions),
                  'officialSogouIndex':35,'localImages':len(assets),'sources':len(sources),
                  'optionalImageWarnings':len(report['issues'])},ensure_ascii=False))
