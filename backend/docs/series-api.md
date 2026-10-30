# 软件系列接口（最小 Demo）

系列下添加版本，截图归属于版本。本文介绍系列资料及小图标；版本创建与查询见 [版本接口说明](version-api.md)，截图上传见 [截图接口说明](screenshot-api.md)。尚未实现独立内容发布、编辑、收藏或草稿。

## 创建系列

`POST /api/series`，需要有效登录 Cookie。必须发送白名单 `Origin`、`X-App-Request: museum-web`，浏览器使用 `credentials: 'include'`。

请求为 `multipart/form-data`：

- `metadata`：必填 JSON part，Content-Type 必须为 `application/json`。
- `icon`：可选图片文件 part。省略时 iconUrl 为 null，前端显示占位图；提交空文件返回 400。

metadata 示例：

```json
{
  "name": "QQ",
  "description": "收集 QQ 各平台的历史版本及截图。",
  "category": "INSTANT_MESSAGING",
  "platforms": ["WINDOWS", "ANDROID"]
}
```

名称去首尾空白后 1～100 个 UTF-16 字符，简介同样处理且为 1～1000 个字符。名称按 Locale.ROOT 转小写后唯一，QQ 与 qq 冲突；不合并中间空白。JSON 拒绝未知字段及错误类型。

分类代码：INSTANT_MESSAGING（即时通讯）、BROWSER（浏览器）、MEDIA（影音娱乐）、OTHER（其他）。

平台代码：WINDOWS、ANDROID、IOS、MACOS、LINUX、OTHER。至少选一个，不允许重复。

图标仅支持真实 PNG/JPEG，原文件不超过 2 MiB，宽高均不超过 2048 像素。服务器重新编码为 PNG，以随机名称存储，不采用上传文件名。全局请求体总大小限制为 6 MiB，图标文件仍单独限制 2 MiB。图标与资料一次提交，数据库保存失败时清理本次图标。

成功返回 `201`，Location 指向系列详情，响应格式：

```json
{
  "series": {
    "id": "系列 UUID",
    "name": "QQ",
    "description": "收集 QQ 各平台的历史版本及截图。",
    "category": "INSTANT_MESSAGING",
    "platforms": ["ANDROID", "WINDOWS"],
    "iconUrl": "/api/series/系列UUID/icon",
    "createdBy": "创建者用户 UUID",
    "createdAt": "2026-10-29T08:00:00Z",
    "updatedAt": "2026-10-29T08:00:00Z"
  }
}
```

createdBy 来自已认证用户，不能由客户端指定。时间为 UTC。

前端提交示例：

```javascript
const form = new FormData();
form.append('metadata', new Blob([JSON.stringify({
  name: 'QQ', description: 'QQ 历史版本资料',
  category: 'INSTANT_MESSAGING', platforms: ['WINDOWS']
})], { type: 'application/json' }));
if (selectedFile) form.append('icon', selectedFile);
const response = await fetch('/api/series', {
  method: 'POST', credentials: 'include',
  headers: { 'X-App-Request': 'museum-web' }, body: form
});
```

不要手动设置整体 Content-Type，浏览器自动生成 boundary。前后端主机名应保持一致。

## 浏览

- `GET /api/series?page=0&size=20`：公开分页查询，page 从 0 开始，size 为 1～100。响应为 `{items: [...], page, size, totalElements, totalPages}`，按创建时间倒序，ID 作为次级排序。
- `GET /api/series/{id}`：公开详情，响应 `{series: {...}}`。
- `GET /api/series/{id}/icon`：公开图标，返回 image/png；系列不存在或未设置图标返回 404。

响应暂不提供版本数量。updatedAt 初始为系列创建时间，成功添加版本时更新；版本列表通过专用接口查询。

## 错误

沿用现有 code、message、requestId、fieldErrors 格式。

| 状态 | code | 场景 |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | 无效字段、JSON、图片、分页参数或 UUID |
| 401 | AUTH_REQUIRED / TOKEN_INVALID / TOKEN_EXPIRED / AUTH_INVALID | 创建时凭据缺失或失效 |
| 403 | REQUEST_FORBIDDEN | 来源或自定义头不符合约定 |
| 404 | SERIES_NOT_FOUND / ICON_NOT_FOUND | 系列或图标不存在 |
| 409 | SERIES_ALREADY_EXISTS | 同名系列已存在 |
| 413 | UPLOAD_TOO_LARGE | 超过上传大小限制 |
| 415 | UNSUPPORTED_MEDIA_TYPE | 整体或 metadata part 的类型不符合约定 |

## 运行与存储

启动时 Flyway 自动执行 V3，不修改 V1/V2、不删除旧数据库。图标默认存储在 `data/uploads/series-icons/`，可通过 `museum.storage.series-icons` 配置。重启必须沿用相同工作目录；备份时同时保留数据库及上传目录。

IDEA 先运行 api/auth.http 完成登录，再运行 api/series.http。此模块没有网页，交由前端按文档接入。
