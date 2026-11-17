# 数字博物馆资料库

按产品系列统一整理：13 个系列、78 个精选版本/历史节点、59 张图片。

同一系列的图片、版本和来源放在同一个目录；直接进入对应目录的 `images/` 即可查看图片。

| 系列 | 图片文件夹 | 精选版本/节点 | 图片 |
| --- | --- | ---: | ---: |
| [腾讯 QQ](qq/README.md) | [qq/images/](qq/images/) | 12 | 12 |
| [微信](wechat/README.md) | [wechat/images/](wechat/images/) | 10 | 4 |
| [Microsoft Windows](windows/README.md) | [windows/images/](windows/images/) | 15 | 15 |
| [MSN Messenger / Windows Live Messenger](msn/README.md) | [msn/images/](msn/images/) | 4 | 4 |
| [Internet Explorer](internet-explorer/README.md) | [internet-explorer/images/](internet-explorer/images/) | 3 | 6 |
| [Mozilla Firefox](firefox/README.md) | [firefox/images/](firefox/images/) | 3 | 1 |
| [Google Chrome](chrome/README.md) | [chrome/images/](chrome/images/) | 2 | 2 |
| [Winamp](winamp/README.md) | [winamp/images/](winamp/images/) | 3 | 3 |
| [Windows Media Player Legacy](windows-media-player/README.md) | [windows-media-player/images/](windows-media-player/images/) | 3 | 2 |
| [搜狗拼音输入法](sogou-pinyin/README.md) | [sogou-pinyin/images/](sogou-pinyin/images/) | 6 | 1 |
| [迅雷](thunder/README.md) | [thunder/images/](thunder/images/) | 6 | 1 |
| [Android](android/README.md) | [android/images/](android/images/) | 6 | 2 |
| [iPhone OS / iOS](ios/README.md) | [ios/images/](ios/images/) | 5 | 6 |

## 使用说明

- 每个系列的`README.md`提供版本与图片对照；`catalog.json`为该系列完整数据。
- [总catalog.json](catalog.json)包含全部系列；所有`localPath`和`evidencePath`相对于所在`catalog.json`目录解析。
- [路径迁移映射](asset-path-mapping.json)记录旧、新路径和原始SHA-256；图片未重绘、压缩或裁剪。
- [整理报告](organization-report.json)；微信504条、搜狗35条官方更新索引在对应系列目录。
- 原始采集批次在[_archive/snapshots/](_archive/snapshots/)，原始ZIP在[_archive/packages/](_archive/packages/)；作为备份保留，不是日常查图入口。
- 全部外部图片仍为待审核参考素材，公开使用前核实授权、署名、商标和隐私。缺失的旧版截图不以新版本替代。

## 离线校验

```powershell
python scripts/verify.py
```

整理脚本`python scripts/organize.py`只读取归档快照，不联网；遇到已有不同内容文件会停止，不覆盖用户内容。
