# 版本截图上传与浏览

截图必须属于已有版本，不能独立发布。一次请求上传一张，同一版本可重复添加多张。前端批量选图时逐张请求，失败后单独重试；每次重试会新增记录，不自动去重。

## 上传

`POST /api/versions/{versionId}/screenshots`

需要有效登录 Cookie、白名单 Origin、`X-App-Request: museum-web`。使用 multipart/form-data：

- image：必填文件，仅真实 PNG/JPEG，非空，原文件不超过 5 MiB。
- caption：可选普通文本，去首尾空白，最多 500 个 UTF-16 字符；空白按 null 保存。

宽高均不超过 8192 像素，总像素不超过 2000 万；后端读取真实尺寸后再解码。图片重新编码为 PNG，不缩放，随机文件名，不沿用上传文件名；重新编码后的文件可能大于原始文件。

成功返回 201，Location 为图片地址，响应：

```json
{
  "screenshot": {
    "id": "截图 UUID",
    "versionId": "所属版本 UUID",
    "imageUrl": "/api/screenshots/截图UUID/image",
    "caption": "登录界面",
    "width": 1024,
    "height": 768,
    "createdBy": "上传者 UUID",
    "createdAt": "2026-10-30T08:00:00Z"
  }
}
```

创建者从认证结果取得。保存失败时清理本次文件，数据库事务回滚；成功后同时更新版本和所属系列的 updatedAt。

```javascript
const form = new FormData();
form.append('image', selectedFile);
form.append('caption', '登录界面');
const response = await fetch(`/api/versions/${versionId}/screenshots`, {
  method: 'POST', credentials: 'include',
  headers: { 'X-App-Request': 'museum-web' }, body: form
});
```

不要手动设置整体 Content-Type，浏览器自动填写 boundary。前后端主机名保持一致。

## 浏览

- `GET /api/versions/{versionId}/screenshots?page=0&size=20`：公开分页列表，按上传时间正序、UUID 次级正序。page 从 0 开始，size 为 1～100，响应 `{items: [截图对象], page, size, totalElements, totalPages}`。已有版本无截图时返回空列表。
- `GET /api/screenshots/{screenshotId}/image`：公开图片，返回 image/png，不暴露磁盘路径。

版本详情接口保持现有结构，前端再调用截图列表接口展示图片与说明。失效 Cookie 不影响公开浏览。没有删除、说明修改、手动排序或缩略图接口。

## 错误

沿用现有 code、message、requestId、fieldErrors 格式。

| 状态 | code | 原因 |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | 缺少或空 image、图片格式或尺寸错误、说明过长、UUID/分页参数错误 |
| 401 | AUTH_REQUIRED / TOKEN_INVALID / TOKEN_EXPIRED / AUTH_INVALID | 上传时未登录或凭据失效 |
| 403 | REQUEST_FORBIDDEN | 来源或必要头不合法 |
| 404 | VERSION_NOT_FOUND / SCREENSHOT_NOT_FOUND | 版本、截图或图片文件不存在 |
| 413 | UPLOAD_TOO_LARGE | 文件超过大小限制或总请求超过 6 MiB |
| 415 | UNSUPPORTED_MEDIA_TYPE | 不是 multipart/form-data |
| 500 | INTERNAL_ERROR | 存储或数据库异常 |

## 运行

新增 V5 迁移，不修改 V1～V4，无需删库。默认存储目录 `data/uploads/version-screenshots/`，可通过 `museum.storage.screenshots` 配置。备份和迁移时同时保留数据库、图标和截图目录，重启沿用相同工作目录。

全局 multipart 文件上限 5 MiB、总请求上限 6 MiB；系列图标仍在业务层执行 2 MiB 限制。

IDEA 重启应用，先按 auth.http、series.http、version.http 准备登录和版本，再运行 screenshot.http。上传请求需准备实际 PNG/JPEG 文件。
