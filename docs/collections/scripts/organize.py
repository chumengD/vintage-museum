"""将已归档的两批采集资料离线汇总到产品系列目录，不访问网络或修改历史快照。

--check-inputs 在归档之前验证输入；默认从 _archive/snapshots 读取并创建系列资料。
已有同名且内容不同的文件会报错，不覆盖用户内容。
"""
import argparse
import copy
import hashlib
import json
import re
import shutil
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BATCHES = ('starter-2026-11-17','expansion-2026-11-17')
EXTRA_INDEXES = {'wechat':'wechat-official-releases.json', 'sogou-pinyin':'sogou-official-releases.json'}
ROLE_NAMES = {'brand_logo':'产品标识','version_screenshot':'版本/系列截图',
              'product_reference_screenshot':'产品参考界面','historical_ui_reference':'历史界面参考',
              'editorial_photo':'文章配图（非界面截图）'}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check-inputs',action='store_true')
args = parser.parse_args()


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def contained(path, base):
    path = path.resolve()
    if not path.is_relative_to(base.resolve()):
        raise ValueError('路径越出资料目录：'+str(path))
    return path


def write_text(path, text):
    contained(path,ROOT)
    data = text.encode('utf-8')
    if path.exists():
        if path.read_bytes()!=data:
            raise FileExistsError('保留已有不同内容，请人工核实：'+str(path))
        return
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(data)


def write_json(path, value):
    write_text(path,json.dumps(value,ensure_ascii=False,indent=2)+'\n')


source_parent = ROOT if args.check_inputs else ROOT/'_archive/snapshots'
catalogs = []
for batch in BATCHES:
    snapshot = contained(source_parent/batch,ROOT)
    catalog = load(snapshot/'catalog.json')
    for asset in catalog['assets']:
        path = contained(snapshot/asset['localPath'],snapshot)
        data = path.read_bytes()
        assert len(data)==asset['bytes'] and hashlib.sha256(data).hexdigest()==asset['sha256'],str(path)
    for key in ('products','versions','assets','sources'):
        assert len(catalog[key])==len({row['id'] for row in catalog[key]})
    catalogs.append((batch,snapshot,catalog))
for key in ('products','versions','assets','sources'):
    ids = [row['id'] for _,_,c in catalogs for row in c[key]]
    assert len(ids)==len(set(ids)), '跨批次ID冲突：'+key
if args.check_inputs:
    print(json.dumps({'preflight':'PASS','products':sum(len(c['products']) for _,_,c in catalogs),
        'versions':sum(len(c['versions']) for _,_,c in catalogs),'images':sum(len(c['assets']) for _,_,c in catalogs)},ensure_ascii=False))
    raise SystemExit(0)

combined = {'schemaVersion':'1.0','scope':'museum-by-product-series','collectedOn':'2026-11-17',
            'organizedOn':'2026-11-17','pathBase':'directory_containing_this_catalog',
            'products':[],'versions':[],'assets':[],'sources':[]}
mapping = []
for batch,snapshot,original in catalogs:
    for original_product in original['products']:
        pid = original_product['id']
        assert re.fullmatch('[a-z0-9-]+',pid)
        folder = contained(ROOT/pid,ROOT)
        product = copy.deepcopy(original_product)
        versions = [copy.deepcopy(v) for v in original['versions'] if v['productId']==pid]
        assets = [copy.deepcopy(a) for a in original['assets'] if a['productId']==pid]
        source_ids = set(product.get('sourceIds',[]))
        source_ids.update(sid for v in versions for sid in v['sourceIds'])
        source_ids.update(a['sourceId'] for a in assets)
        extra = EXTRA_INDEXES.get(pid)
        official = load(snapshot/extra) if extra else None
        if official:
            if official.get('sourceId'):
                source_ids.add(official['sourceId'])
            source_ids.update(r['sourceId'] for r in official['releases'] if r.get('sourceId'))
        sources = [copy.deepcopy(s) for s in original['sources'] if s['id'] in source_ids]
        assert {s['id'] for s in sources}==source_ids
        product.update({'sourceSnapshot':batch,'imageDirectory':'images'})
        for version in versions:
            version['sourceSnapshot'] = batch
        occurrences = Counter()
        for asset in assets:
            source = contained(snapshot/asset['localPath'],snapshot)
            base = asset.get('versionId') or {
                'brand_logo':'brand-logo','product_reference_screenshot':'product-reference',
                'historical_ui_reference':asset['id'],'editorial_photo':'editorial-photo'
            }.get(asset['role'],asset['id'])
            assert re.fullmatch('[a-zA-Z0-9_-]+',base)
            occurrences[base] += 1
            suffix = '' if occurrences[base]==1 else '-'+str(occurrences[base])
            relative = 'images/'+base+suffix+source.suffix.lower()
            target = contained(folder/relative,folder)
            target.parent.mkdir(parents=True,exist_ok=True)
            if target.exists():
                assert hashlib.sha256(target.read_bytes()).hexdigest()==asset['sha256'], '已有图片内容不同：'+str(target)
            else:
                shutil.copy2(source,target)
            mapping.append({'assetId':asset['id'],'productId':pid,'sha256':asset['sha256'],
                'archivedPath':source.relative_to(ROOT).as_posix(),'organizedPath':target.relative_to(ROOT).as_posix()})
            asset.update({'sourceSnapshot':batch,'originalLocalPath':asset['localPath'],'localPath':relative})
        for source in sources:
            source['sourceSnapshot'] = batch
            if source.get('evidencePath'):
                receipt = contained(snapshot/source['evidencePath'],snapshot)
                assert receipt.is_file()
                source['evidencePath'] = '../'+receipt.relative_to(ROOT).as_posix()
        catalog = {'schemaVersion':'1.0','scope':'single-product-series','collectedOn':original['collectedOn'],
                   'pathBase':'directory_containing_this_catalog','products':[product],'versions':versions,
                   'assets':assets,'sources':sources}
        write_json(folder/'catalog.json',catalog)
        write_json(folder/'product.json',product)
        for filename,key in [('versions.json','versions'),('assets.json','assets'),('sources.json','sources')]:
            write_json(folder/filename,catalog[key])
        if official:
            write_json(folder/'official-releases.json',official)
        asset_map = {a['id']:a for a in assets}
        refs = {s['id']:s for s in sources}
        lines = ['# '+product['name'],'',product['summary'],'',
            f"{len(versions)} 个精选版本/节点，{len(assets)} 张图片。所有图片在 [images/](images/)；图片文件名尽量使用版本编号。",'',
            '图片为原始参考素材，仍需审核授权、商标和隐私；不是每个版本都有匹配截图。','',
            '## 版本','', '| 版本 | 日期 | 图片 | 来源 |','| --- | --- | --- | --- |']
        for version in sorted(versions,key=lambda v:(v['timelineYear'],v.get('releasedAt') or '',v['id'])):
            when = version['releasedAt'] or str(version['timelineYear'])+'（仅年份/名称年份，详见JSON）'
            image_links = '、'.join('[图'+str(i+1)+']('+asset_map[aid]['localPath']+')' for i,aid in enumerate(version['assetIds'])) or '暂缺'
            source_links = '、'.join('[来源'+str(i+1)+']('+refs[sid]['url']+')' for i,sid in enumerate(version['sourceIds']))
            lines.append('| '+' | '.join([version['version'],when,image_links,source_links])+' |')
        lines += ['','## 图片目录','', '| 文件 | 类型 | 说明 |','| --- | --- | --- |']
        for asset in assets:
            label = Path(asset['localPath']).name
            note = (asset.get('caption') or asset.get('matchNote') or '').replace('|','\\|').replace('\n',' ')
            lines.append('| ['+label+']('+asset['localPath']+') | '+ROLE_NAMES[asset['role']]+' | '+note+' |')
        notes = [v for v in versions if v.get('dateNote')]
        if notes:
            lines += ['','## 日期备注','']
            lines += ['- '+v['version']+'：'+v['dateNote'] for v in notes]
        lines += ['','## 结构化资料','',
            '- [完整JSON](catalog.json)；[产品](product.json)；[版本](versions.json)；[图片元数据与授权](assets.json)；[来源](sources.json)。']
        if official:
            lines += ['- [官网更新索引](official-releases.json)：'+str(len(official['releases']))+' 条。']
        lines += ['- [原始采集快照](../_archive/snapshots/'+batch+'/README.md)；[返回总目录](../README.md)。','']
        write_text(folder/'README.md','\n'.join(lines))
        combined['products'].append(dict(product,imageDirectory=pid+'/images'))
        combined['versions'].extend(versions)
        for asset in assets:
            combined['assets'].append(dict(asset,localPath=pid+'/'+asset['localPath']))
        for source in sources:
            if not any(s['id']==source['id'] for s in combined['sources']):
                aggregate_source = dict(source)
                if aggregate_source.get('evidencePath'):
                    aggregate_source['evidencePath'] = aggregate_source['evidencePath'].removeprefix('../')
                combined['sources'].append(aggregate_source)

# 某些来源只在原批次登记、未绑定展品；仍保留在原始快照，不丢失溯源信息。
write_json(ROOT/'catalog.json',combined)
write_json(ROOT/'asset-path-mapping.json',mapping)
report = {'products':len(combined['products']),'curatedVersions':len(combined['versions']),
          'images':len(combined['assets']),'originalImages':sum(len(c['assets']) for _,_,c in catalogs),
          'officialIndexes':{pid:len(load(ROOT/pid/'official-releases.json')['releases']) for pid in EXTRA_INDEXES},
          'originalSnapshotsPreserved':list(BATCHES),
          'note':'系列目录是日常入口；原始快照和旧ZIP保存在_archive，保留原路径体系及采集脚本。'}
write_json(ROOT/'organization-report.json',report)
lines = ['# 数字博物馆资料库','',
    f"按产品系列统一整理：{report['products']} 个系列、{report['curatedVersions']} 个精选版本/历史节点、{report['images']} 张图片。",'',
    '同一系列的图片、版本和来源放在同一个目录；直接进入对应目录的 `images/` 即可查看图片。','',
    '| 系列 | 图片文件夹 | 精选版本/节点 | 图片 |','| --- | --- | ---: | ---: |']
for product in combined['products']:
    pid = product['id']
    count_versions = sum(v['productId']==pid for v in combined['versions'])
    count_assets = sum(a['productId']==pid for a in combined['assets'])
    lines.append('| ['+product['name']+']('+pid+'/README.md) | ['+pid+'/images/]('+pid+'/images/) | '+str(count_versions)+' | '+str(count_assets)+' |')
lines += ['','## 使用说明','',
    '- 每个系列的`README.md`提供版本与图片对照；`catalog.json`为该系列完整数据。',
    '- [总catalog.json](catalog.json)包含全部系列；所有`localPath`和`evidencePath`相对于所在`catalog.json`目录解析。',
    '- [路径迁移映射](asset-path-mapping.json)记录旧、新路径和原始SHA-256；图片未重绘、压缩或裁剪。',
    '- [整理报告](organization-report.json)；微信504条、搜狗35条官方更新索引在对应系列目录。',
    '- 原始采集批次在[_archive/snapshots/](_archive/snapshots/)，原始ZIP在[_archive/packages/](_archive/packages/)；作为备份保留，不是日常查图入口。',
    '- 全部外部图片仍为待审核参考素材，公开使用前核实授权、署名、商标和隐私。缺失的旧版截图不以新版本替代。','',
    '## 离线校验','',
    '```powershell','python scripts/verify.py','```','',
    '整理脚本`python scripts/organize.py`只读取归档快照，不联网；遇到已有不同内容文件会停止，不覆盖用户内容。','']
write_text(ROOT/'README.md','\n'.join(lines))
print(json.dumps(report,ensure_ascii=False))
