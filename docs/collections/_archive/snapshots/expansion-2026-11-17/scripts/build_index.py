"""从catalog生成中文浏览清单，不访问网络。"""
import json
from collections import Counter
from pathlib import Path

root = Path(__file__).resolve().parents[1]
catalog = json.loads((root/'catalog.json').read_text(encoding='utf-8'))
products, versions, assets, sources = [catalog[key] for key in ('products','versions','assets','sources')]
asset_map = {a['id']:a for a in assets}
source_map = {s['id']:s for s in sources}
counts = Counter(a['role'] for a in assets)
lines = ['# 数字博物馆：第二批典型应用与系统','',
    f"资料快照：{catalog['collectedOn']}。{len(products)} 个产品，{len(versions)} 个代表版本/节点，{len(assets)} 张本地图片。",'',
    '这是一份精选样本，不是完整版本史。仅精确到年份的记录不补造月日；SDK发布、公开测试、稳定发布和系列节点保留区别。', '',
    '图片均为参考资料，默认待审核；产品Logo和新版界面不自动绑定早期版本。系列截图可能来自后续补丁、不同设备或语言，见图注。','']
for product in products:
    lines += ['## '+product['name'], '', product['summary'], '',
              '开发者/组织：'+product['developer']+'。', '',
              '| 版本或节点 | 日期 | 节点说明 | 版本截图 | 来源 |',
              '| --- | --- | --- | --- | --- |']
    rows = sorted([v for v in versions if v['productId']==product['id']],key=lambda v:(v['timelineYear'],v['releasedAt'] or '',v['id']))
    for version in rows:
        when = version['releasedAt'] or str(version['timelineYear'])+'（仅年份）'
        if version['dateKind']=='sdk_release':
            when += '（SDK）'
        photos = '、'.join('[图'+str(i+1)+']('+asset_map[aid]['localPath']+')' for i,aid in enumerate(version['assetIds'])) or '待补充'
        refs = '、'.join('[来源'+str(i+1)+']('+source_map[sid]['url']+')' for i,sid in enumerate(version['sourceIds']))
        lines.append('| '+ ' | '.join([version['version'],when,version['summary'],photos,refs])+' |')
    lines += ['']
    for version in rows:
        if version.get('dateNote'):
            lines += ['- 日期备注（'+version['version']+'）：'+version['dateNote']]
    related = [a for a in assets if a['productId']==product['id']]
    if related:
        lines += ['', '### 图片与使用边界', '']
        for asset in related:
            label = asset['caption'] or asset['wikiFileTitle'].removeprefix('File:')
            kind = {'brand_logo':'产品/历史标识','product_reference_screenshot':'产品参考界面','version_screenshot':'版本/系列参考界面'}[asset['role']]
            lines += ['- ['+label+']('+asset['localPath']+')（'+kind+'，'+str(asset['width'])+'×'+str(asset['height'])+'）',
                      '  - '+asset['matchNote'],
                      '  - 授权字段：'+(asset['licenseName'] or '来源未提供，需核实')+'；[图片说明页]('+asset['descriptionUrl']+')。']
    lines += ['']
lines += ['## 补充索引与结构化数据', '',
    '- [搜狗官网35条历史更新记录](sogou-official-releases.json)：2006—2014年，保留测试版和构建号。',
    '- [完整JSON](catalog.json)；[产品](products.json)；[版本](versions.json)；[图片](assets.json)；[来源](sources.json)。',
    '- [采集报告](collection-report.json)列出尚无截图的版本和采集异常；缺图不以其他版本替代。',
    '- [使用与复跑说明](README.md)。','']
(root/'版本浏览清单.md').write_text('\n'.join(lines),encoding='utf-8')
print('Generated 版本浏览清单.md:',len(products),'products,',len(versions),'versions,',len(assets),'images')
