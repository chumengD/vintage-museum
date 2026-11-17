"""从已采集的JSON生成便于人工浏览的清单，不发出网络请求。"""
import json
from collections import Counter
from pathlib import Path

root = Path(__file__).resolve().parents[1]
catalog = json.loads((root/'catalog.json').read_text(encoding='utf-8'))
report = json.loads((root/'collection-report.json').read_text(encoding='utf-8'))
assets = {a['id']:a for a in catalog['assets']}
lines = ['# 博物馆版本浏览清单', '',
         f"采集日期：{catalog['collectedOn']}。{len(catalog['products'])}个产品系列，{len(catalog['versions'])}个精选版本，{len(assets)}个有效本地图片文件；另附微信官网{report['officialWechatIndexCount']}条分平台版本日期索引。", '',
         '图片均为待审核参考素材，不能由“已收录”推定“可以公开转载”。未配图的版本明确留空，不用新Logo冒充旧界面。', '']
for product in catalog['products']:
    lines += ['## '+product['name'], '', '| 版本 | 日期或展览年份 | 简介 | 参考图片 |', '| --- | --- | --- | --- |']
    for version in catalog['versions']:
        if version['productId'] != product['id']:
            continue
        when = version['releasedAt'] or str(version['timelineYear'])+'（版本年号，首发日待核实）'
        images = '、'.join(f"[图{i}]({assets[aid]['localPath']})" for i,aid in enumerate(version['assetIds'],1)) or '待补图'
        lines.append('| '+version['version']+' | '+when+' | '+version['summary']+' | '+images+' |')
    lines.append('')
    for aid in product['logoAssetIds']:
        lines.append(f"通用标识：[查看图片]({assets[aid]['localPath']})。此图不代表任何旧版本的历史标识。")
        lines.append('')
lines += ['## 图片样例', '', '仅供核对素材内容，完整来源和许可字段见 assets.json。', '']
for prefix,label in [('qq-2008','QQ 2008参考界面'),('wechat-ios-8-0-screen-2','微信8.0状态界面'),('windows-xp','Windows XP参考桌面')]:
    selected = next((asset for asset in assets.values() if asset['id'].startswith(prefix)),None)
    if selected:
        lines += ['### '+label,'',f"![{selected['caption']}]({selected['localPath']})",'',selected['caption'],'']
lines += ['## 待完善项', '',
          '- 没有精确首发日的QQ年号版本，继续查官方发布存档。',
          '- 缺图版本补充来源、版本及补丁号能够对应的真实界面截图。',
          '- 对所有拟上线图片逐张完成版权、署名、商标与隐私检查。',
          '- 具体下载失败、原站重复版本标签等情况，见 collection-report.json。', '']
(root/'版本浏览清单.md').write_text('\n'.join(lines),encoding='utf-8')
print('Browse index generated:', root/'版本浏览清单.md')
