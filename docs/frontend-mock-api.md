# 前端模拟接口

`openapi.yaml` 是已约定的登录接口契约，未修改。本文件记录设计稿所需、但 OpenAPI 尚未覆盖的临时业务接口；实现位于 `frontend/src/mocks/handlers.js`，供后端后续对接。

所有路径以 `/api` 开头，JSON 请求／响应。错误格式为 `{ "message": "错误说明" }`。用户写操作、收藏、个人档案和草稿要求登录。前端 API 客户端发送 `credentials: include`，不读取 JWT、不设置 Authorization。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/series` | 系列数组；包括用于按版本／平台检索的 `searchText` |
| GET | `/series/:id` | 系列详情，附带 `versions` |
| POST | `/series` | 创建系列；名称重复返回 409 |
| GET | `/versions/:id` | 版本详情，附带 `series`、同平台 `siblings` |
| POST | `/versions` | 发布版本；同系列／平台／版本号重复返回 409 |
| PUT | `/versions/:id` | 编辑版本，保留上一版正文及作者、日期 |
| GET | `/versions/:id/revisions` | 修改历史数组 |
| GET | `/versions/:id/contributors` | 贡献者名称数组 |
| GET / POST | `/versions/:id/comments` | 读取／发表讨论；POST 支持 `parentId` 回复 |
| GET | `/favorites` | 当前用户的系列／版本收藏数组 |
| POST | `/favorites` | `{ "key": "series:firefox" }` 切换收藏，返回 `{ "saved": true }` |
| GET / PATCH | `/profile` | 当前用户档案／修改姓名、简介、地区、网站 |
| GET | `/contributors/:id` | 公开档案，不含邮箱、草稿或收藏列表 |
| GET / POST | `/drafts` | 读取／保存草稿；POST 携带 id 时更新 |
| GET / DELETE | `/drafts/:id` | 恢复／删除草稿 |
| POST | `/auth/password-reset` | 找回密码演示；不发送真实邮件 |

系列主要字段：`id, name, icon, iconImage, category, platforms[], tags[], description, source, updatedAt`。

版本主要字段：`id, seriesId, number, date (YYYY-MM-DD), platform, iconImage, screenshots[{name,url}], caption, source, body (Markdown), updatedAt`。

草稿字段：`id, type (series|version), title, data (表单快照), updatedAt`。

演示数据保存在当前站点的 IndexedDB `vintage-museum-demo-v2`。初始资料来自设计稿的占位内容，统计总数并不等同于已录入的演示版本节点数量。所有本地演示账户共用同一套种子馆藏与个人工作区；这不是服务端多租户权限实现。真实后台需要按登录用户隔离个人数据。

演示图片使用 data URL 保存，限制 PNG/JPG/WEBP、每张 10 MB；真实后端上线时需另行约定文件上传接口、存储 URL 和大小限制。收藏、草稿、密码找回等临时接口仍需补充到正式 OpenAPI 并由后端实现。
