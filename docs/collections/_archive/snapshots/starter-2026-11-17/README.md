# 数字记忆博物馆首批资料包

面向 QQ、微信、Windows 的资料整理，采集于 2026 年 11 月 17 日。适合做产品资料卡、历史时间线、版本详情页的初始内容，不是安装包档案或完整软件更新日志。

## 先看哪些文件

| 文件 | 用途 |
| --- | --- |
| `catalog.json` | 完整入口，包含产品、精选版本、图片和来源 |
| `products.json` | 3 个产品系列 |
| `versions.json` | 37 个代表性版本：QQ 12 个、微信 iOS 10 个、Windows 15 个 |
| `版本浏览清单.md` | 可读的版本清单与图片链接 |
| `wechat-official-releases.json` | 额外采集的微信官网分平台版本日期索引，实际条数见报告 |
| `assets.json` | 每张图片的本地路径、来源、尺寸、校验值、版权字段 |
| `assets/reference-only/` | 实际下载的图片，只作本地研究和待审素材 |
| `sources.json` | 来源网页、采集日期、网页哈希，Wiki 条目另附修订号 |
| `versions.jsonl` | 一行一个精选版本，方便后续编写导入程序 |
| `collection-report.json` | 实际采集数量、失败原因、缺图项和源站异常 |
| `provenance/` | Wikimedia 图片许可元数据和 Wiki 修订号回执 |

仅新增这个资料目录，没有修改前后端业务代码、数据库、登录接口或现有原型。

## 已整理的范围

- QQ：OICQ 1999、QQ 2000、2003、2004、2005、2007、2008、2009、2010、2011、2012、2013。
- 微信：iOS 1.0 测试版、2.0、2.5、3.0、4.0、4.2、5.0、6.0、7.0.0、8.0.0。日期从官网 iOS 列表读取。
- Windows：1.0 系列、2.0 系列、3.0、3.1、95、98、2000、Me、XP、Vista、7、8、8.1、10、11。
- 微信额外索引：官网当前能够解析的 Android、iOS、HarmonyOS、HarmonyOS 电脑、Windows、Mac、Linux、其他平台条目。只采集公开可见的版本号、平台和日期，不编造旧版更新日志。

## 日期和版本的注意事项

1. `releasedAt` 为已取得来源的日期；`timelineYear` 用于展览排序。QQ 年号版没有确认首发日时，`releasedAt` 保持 `null`，不会伪造“2008-01-01”。
2. 同一微信版本号在不同平台的发布日期不能合并。额外索引还保留了“同平台、同版本号、不同日期”的源站记录，用日期参与唯一标识，避免覆盖。
3. Windows 使用面向公众的发行日期作为整理目标，不把 RTM 当成零售上市日。不同地区、版本系列和源站描述可能存在差异，`sources.json` 留有实际日期行，报告中会列出待复核项。
4. Windows 的截图按主版本或系列关联，不保证是首发构建、特定 Service Pack 或简体中文版。QQ图集存在alt错位，已按画面窗口标题纠正QQ2004、2007、2010、2011、2012等关联，规则保存在 `reviewed-image-rules.json`；看不到年份的图不强行关联。补丁号仍未核实。
5. `summary` 是简短的编辑性概括，不是逐项核验过的官方更新日志。历史功能的首次上线时间如需用于正式展签，应继续核对原始发布记录。

## 图片怎么用

图片是实际保存的文件，不是只放了失效的外链。每张图都有 `sha256`，下载失败、占位图和尺寸不足的图片不会进入有效素材列表。

通用 Logo 的 `role` 为 `brand_logo`，`versionId` 为空；它们不会被自动套到所有旧版本。版本截图的 `role` 为 `version_screenshot`，通过 `versionId` 与版本关联。`editorial_photo`是新闻装饰配图，`historical_ui_reference`是尚不能确认具体主版本的历史界面图，两者均不充当特定版本的截图。

所有外部图片默认 `safeToAutoPublish: false`。维基百科上的截图可能是非自由内容，Wikipedia 的合理使用说明不等于你的网站获得许可；新闻网站配图同样不代表可自由转载。已提取的 Commons/MediaWiki 许可、作者和限制保留在 `assets.json`，没有明确许可的图片标为待审。公开上线前逐张确认版权、署名及商标使用要求，必要时改为你们自行合法截取、获授权或符合明确许可的素材。

本包不下载 `.exe`、`.apk`、`.iso` 等程序，不提供破解程序或序列号，也不额外提取账号、聊天记录或联系方式作为用户数据。来源截图可能包含原作者昵称、演示账号等标识，公开前还应检查隐私信息，本包不替你判断这些账号的真伪。

## 数据关系

`products[].versionIds` → `versions[].id`；`versions[].assetIds` → `assets[].id`；每项资料的 `sourceIds` 或 `sourceId` → `sources[].id`。

图片的 `localPath` 相对于本目录，不是线上可访问的 URL。后续存入对象存储或静态目录时，需要另外生成公开地址，并完成图片审核。不要把整个 `reference-only` 目录直接作为生产素材发布。

目前还没有“藏品/版本”的后端实体表，因此没有擅自生成面向虚构表结构的 SQL 或写入现有账号数据库。确定表结构后，可用 `versions.jsonl` 编写导入程序。

## 采集来源

- [微信官网历史版本列表](https://weixin.qq.com/cgi-bin/readtemplate?lang=zh_CN&t=weixin_faq_list)：分平台日期索引。
- [新浪转载的 BLUES QQ20周年回顾](https://tech.sina.com.cn/csj/2019-02-11/doc-ihqfskcp4201086.shtml)：QQ 历史版本和带图注的老截图；不是腾讯官方发布页。
- [腾讯大讲堂社区转载的 QQ15周年回顾](https://developer.cloud.tencent.com/article/1088789)：辅助核对；“腾讯云”域名不等于全部内容都是官方发布。
- [微软50周年时间线](https://news.microsoft.com/microsoft-50/)与[Windows版本列表](https://en.wikipedia.org/wiki/List_of_Microsoft_Windows_versions)：发行日及版本线索。
- 各 Windows Wiki 条目和 Wikimedia 文件页：版本截图及原文件许可信息，具体链接见 `sources.json`、`assets.json`。
- 微信发布时的新闻报道：仅作界面和简要功能的辅助来源，不能替代官网的平台日期。

## 离线校验与重新采集

需要 Python 3.10+，依赖见 `requirements.txt`。建议使用独立虚拟环境，不修改业务项目依赖。

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python scripts\verify.py
```

重新采集会改变资料快照，应先备份已有整理结果，再显式确认替换生成文件：

```powershell
.\.venv\Scripts\python scripts\collect.py --replace-generated
.\.venv\Scripts\python scripts\verify.py
```

采集脚本尊重 HTTP 429 的等待要求，不关闭 TLS 校验，不绕过登录/付费限制。无法读取的来源和图片写入报告，不能当作已成功采集。线上来源可能改版，重新运行不保证与本快照相同。
