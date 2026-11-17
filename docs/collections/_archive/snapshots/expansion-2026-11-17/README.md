# 数字博物馆资料包 · 第二批

快照日期：2026-11-17。此包独立于第一批QQ、微信、Windows资料，没有修改业务代码或数据库。

## 收录范围

MSN / Windows Live Messenger、Internet Explorer、Firefox、Chrome、Winamp、Windows Media Player Legacy、搜狗拼音、迅雷、Android、iPhone OS / iOS，共10个产品、41个精选版本或历史节点。另有搜狗官网2006—2014年的35条历史更新记录。图片数量和缺图情况以采集报告为准。

从 [版本浏览清单](版本浏览清单.md) 开始查看；需要程序读取时用 `catalog.json`。

## 文件与字段

- `catalog.json`：完整数据，包含products、versions、assets、sources；各数组另有同名JSON分表。
- `versions.jsonl`：一行一个版本，适合后续编写导入脚本。
- `sogou-official-releases.json`：官方更新索引，不是35个全有截图的展品。
- `assets/reference-only/`：下载的原始图片，无裁剪、去水印或重绘。
- `provenance/`：页面抓取凭据、Wiki修订号和图片API原始元数据。
- `collection-spec.json`：人工精选数据；`reviewed-image-rules.json`：图片匹配、排除和年代边界规则。
- `collection-report.json`：数量、异常和缺图版本。

产品、版本、图片通过`productId`、`versionId`、`assetIds`关联。无可靠旧版截图的版本保留空数组；不拿Logo或现代界面填补。

## 日期和版本边界

这不是完整版本史。`releasedAt`有值时为明确日期；只确认年份时为null，使用`timelineYear`和`datePrecision: year`，不补造1月1日。`recordType`区分发布、系列和平台里程碑；`dateKind`保留公开测试、SDK和XP公开下载等口径。

Android1.0节点是SDK发布，不是首款手机上市；迅雷采用官网年表，只有年份。IE6存在8月24日与27日的日期口径差异，本批只保留2001年。WMP11采用微软2006-10-30的XP公开下载记录，不混用Wiki表格的另一个日期。WMP12仅记2009年系列起点。iPhone早期保留iPhone OS名称。

系列截图可能来自后续补丁或不同设备：如Android2.3.7、Android4.4.2、iPhone OS3.1、iOS4.1、iOS7.1和Windows11上的WMP12；它们不是对应系列首发构建截图。`caption`和`matchNote`保留这一边界。Wiki资料只做来源记录，不保证无误。

## 图片授权与发布

全部外部图片默认`publicationStatus: review_required`、`safeToAutoPublish: false`；展品数据为draft。这是开发用参考素材，**不等于已经取得公开展示许可**。

`licenseName`、`licenseUrl`、`creator`、`credit`、`restrictions`来自媒体说明页，不是本项目授予的许可。Wikipedia的non-free / fair-use规则不能自动延伸到本网站。即使标为自由许可，仍须核实归属、署名、版本、商标和截图内第三方内容；联系人、账号等信息也需做隐私审核。发布前请逐图确认，不能直接把目录全量暴露为公共静态资源。

资料摘要为中文整理，不复制百科正文。没有下载软件安装包、APK、ISO，也没有运行历史软件。

## 校验与复跑

需要Python3.10+。建议在自己的虚拟环境安装`requirements.txt`，不修改全局环境。`--deps`可指定已有依赖目录。

```powershell
python -m pip install -r requirements.txt
python scripts/verify.py
python scripts/build_index.py
python scripts/package.py ..\museum-expansion-2026-11-17.zip
```

现有数据默认受保护。要重新采集生成文件，显式运行：

```powershell
python scripts/collect.py --replace-generated
```

脚本复用`.cache`保存的同一快照请求，不把它当成实时最新版。要建立新日期快照，请复制spec、rules和scripts到新目录，更新spec中的日期后重新采集，不覆盖本快照。网络限流会遵守Retry-After，失败会记录在报告中。离线校验检查引用、日期精度、文件哈希、尺寸和图片格式；它不能替代历史考证、授权或隐私审核。ZIP打包不含缓存或虚拟环境，且拒绝覆盖已有ZIP。

如需仅用已成功缓存的请求重建，可加`--offline`；这不会重试限流URL。之前的报告按内容哈希留在`provenance/collection-attempts/`。图片不是每个版本的必填项，下载失败为可选图片警告；`verify.py`通过只代表现有数据结构和文件通过核验，不代表41个版本都有图。
