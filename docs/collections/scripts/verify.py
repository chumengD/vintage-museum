"""仅使用Python标准库核验整理后的路径、元数据和原始图片内容。"""
import hashlib
import json
import re
from pathlib import Path
from zipfile import ZipFile

root = Path(__file__).resolve().parents[1]
load = lambda path:json.loads(path.read_text(encoding='utf-8'))
catalog = load(root/'catalog.json')
report = load(root/'organization-report.json')
mapping = load(root/'asset-path-mapping.json')
products,versions,assets,sources = [catalog[k] for k in ('products','versions','assets','sources')]
assert len(products)==len({p['id'] for p in products})==report['products']==13
assert len(versions)==len({v['id'] for v in versions})==report['curatedVersions']==78
assert len(assets)==len({a['id'] for a in assets})==report['images']==59
assert len(mapping)==59
source_ids = {s['id'] for s in sources}
asset_ids = {a['id'] for a in assets}
version_ids = {v['id'] for v in versions}
mapping_ids = {r['assetId'] for r in mapping}
assert asset_ids==mapping_ids
for item in mapping:
    for key in ('archivedPath','organizedPath'):
        file = (root/item[key]).resolve()
        assert file.is_relative_to(root) and file.is_file()
        assert hashlib.sha256(file.read_bytes()).hexdigest()==item['sha256']
for product in products:
    pid = product['id']
    folder = root/pid
    local = load(folder/'catalog.json')
    assert len(local['products'])==1 and local['products'][0]['id']==pid
    for filename,key in [('versions.json','versions'),('assets.json','assets'),('sources.json','sources')]:
        assert load(folder/filename)==local[key]
    assert load(folder/'product.json')==local['products'][0]
    assert {v['id'] for v in local['versions']}=={v['id'] for v in versions if v['productId']==pid}
    assert {a['id'] for a in local['assets']}=={a['id'] for a in assets if a['productId']==pid}
    assert set(product['versionIds'])=={v['id'] for v in local['versions']}
    for asset in local['assets']:
        file = (folder/asset['localPath']).resolve()
        assert file.is_relative_to(folder/'images') and file.is_file()
        data = file.read_bytes()
        assert len(data)==asset['bytes'] and hashlib.sha256(data).hexdigest()==asset['sha256']
        assert asset['sourceId'] in source_ids
        assert asset['safeToAutoPublish'] is False and asset['publicationStatus']=='review_required'
        if asset.get('versionId'):
            assert asset['versionId'] in version_ids
        aggregate = next(a for a in assets if a['id']==asset['id'])
        assert aggregate['localPath']==pid+'/'+asset['localPath']
    for source in local['sources']:
        if source.get('evidencePath'):
            assert (folder/source['evidencePath']).resolve().is_file()
    files = {f.relative_to(folder).as_posix() for f in (folder/'images').iterdir() if f.is_file()}
    assert files=={a['localPath'] for a in local['assets']}
for version in versions:
    assert set(version['assetIds'])<=asset_ids and set(version['sourceIds'])<=source_ids
for source in sources:
    if source.get('evidencePath'):
        assert (root/source['evidencePath']).resolve().is_file()
for pid,count in report['officialIndexes'].items():
    assert len(load(root/pid/'official-releases.json')['releases'])==count
for md in [root/'README.md']+[root/p['id']/'README.md' for p in products]:
    for match in re.finditer(r'\]\(([^)]+)\)',md.read_text(encoding='utf-8')):
        target = match[1]
        if target.startswith(('http://','https://','#')):
            continue
        assert (md.parent/target).exists(), str(md)+' -> '+target
for name in ('museum-starter-2026-11-17.zip','museum-expansion-2026-11-17.zip'):
    with ZipFile(root/'_archive/packages'/name) as archive:
        assert archive.testzip() is None
print(json.dumps({'result':'PASS','products':len(products),'curatedVersions':len(versions),
    'images':len(assets),'originalAndOrganizedHashesMatch':True,'officialIndexes':report['officialIndexes']},ensure_ascii=False))
