# 个人资料与公开贡献者档案接口

原型个人主页：头像、用户名、个人简介、右上角「编辑资料」；下方 tab「主页 / 发布 / 收藏」，统计行「发布内容 12　创建系列 3　收藏系列 8」；子 tab「我的发布 / 我创建的系列 / 草稿箱（2）」。

需要两组能力：**本人可写的资料**（显示名、简介、头像）和**公开的贡献者档案**（别人点进贡献者名字看到的页面）。公开档案只展示公开信息，绝不暴露邮箱。

相关文档：[总览与约定](api-overview.md)、[登录接口](auth-api.md)、[编辑接口](editing-api.md)、[草稿接口](drafts-api.md)、[密码接口](password-api.md)。

## 数据模型

V10 迁移扩展 `app_users`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `display_name` | VARCHAR(40) NULL | 显示名，空白按 `null` 保存 |
| `bio` | VARCHAR(200) NULL | 个人简介，纯文本，空白按 `null` 保存 |
| `avatar_storage_key` | VARCHAR(100) NULL | 头像文件名，物理文件在 `data/uploads/avatars/` |

既有字段不变：`username`（公开昵称兜底，唯一）、`email`（仅本人可见）、`status`、`created_at`。

显示规则：`displayName` 为空时，所有对外展示回退到 `username`。头像为空时前端显示默认占位图，接口返回 `avatarUrl: null`。

## 接口

### 修改资料

`PATCH /api/me/profile`

需要登录 Cookie、白名单 `Origin`、`X-App-Request: museum-web`、`Content-Type: application/json`。

```json
{
  "displayName": "老周",
  "bio": "记录和分享软件资料。"
}
```

- `displayName`：可选，去首尾空白后 1～40 个 UTF-16 字符；传空字符串或 `null` 表示清除显示名（回退 `username`）。
- `bio`：可选，去首尾空白后最多 200 个字符；空字符串或 `null` 表示清除。不允许换行以外的富文本，前端按纯文本展示。
- 只传一个字段即只改一个字段；`{}` 合法但无改动，返回 200 不更新 `updatedAt` 语义（用户表不维护 `updatedAt`）。
- 用户名、邮箱、密码不在此接口修改（密码见 [密码接口](password-api.md)）。

成功返回 `200`：

```json
{
  "user": {
    "id": "用户 UUID",
    "username": "laozhou",
    "displayName": "老周",
    "bio": "记录和分享软件资料。",
    "avatarUrl": "/api/users/用户UUID/avatar",
    "createdAt": "2026-09-01T08:00:00Z"
  }
}
```

`GET /api/auth/me` 的响应用同一结构（追加 `displayName`、`bio`、`avatarUrl`），前端登录态初始化可直接复用。

### 上传头像

`POST /api/me/avatar`

需要登录 Cookie 与写请求头。`multipart/form-data`，字段名 `image`：

- 真实 PNG/JPEG，非空，原文件 ≤2 MiB；
- 宽高均 ≤2048 像素，总像素 ≤400 万；
- 服务端重新编码为 PNG，文件名随机，不沿用上传文件名；
- 替换头像成功后删除旧文件；文件写入成功但数据库失败时清理新文件。

成功返回 `200`（不是 201，头像属于资料更新而非新资源）：

```json
{
  "user": {
    "id": "用户 UUID",
    "username": "laozhou",
    "displayName": "老周",
    "bio": "记录和分享软件资料。",
    "avatarUrl": "/api/users/用户UUID/avatar"
  }
}
```

`avatarUrl` 带随机文件名后缀（如 `/api/users/用户UUID/avatar` 内部按最新文件返回），前端可用固定 URL，配合 `Cache-Control: no-store` 避免旧头像缓存。

```javascript
const form = new FormData();
form.append('image', file);
await fetch('/api/me/avatar', {
  method: 'POST', credentials: 'include',
  headers: { 'X-App-Request': 'museum-web' }, body: form
});
```

### 删除头像

`DELETE /api/me/avatar`

成功返回 `204`，删除记录与文件；本来没有头像也返回 204。

### 读取头像

`GET /api/users/{userId}/avatar`

公开接口，返回 `image/png`。未设置头像或用户不存在返回 404 `AVATAR_NOT_FOUND`，前端显示占位图。

### 公开档案

`GET /api/users/{userId}`

公开接口，无需登录。返回公开信息与统计：

```json
{
  "user": {
    "id": "用户 UUID",
    "username": "laozhou",
    "displayName": "老周",
    "bio": "记录和分享软件资料。",
    "avatarUrl": "/api/users/用户UUID/avatar",
    "createdAt": "2026-09-01T08:00:00Z"
  },
  "stats": {
    "publishedVersions": 12,
    "createdSeries": 3,
    "favoriteSeries": 8,
    "favoriteVersions": 2,
    "comments": 5,
    "edits": 21
  }
}
```

统计口径：

- `publishedVersions`：该用户创建且 `PUBLISHED` 的版本数（含已编辑过的，按创建者归属）。
- `createdSeries`：该用户创建且 `PUBLISHED` 的系列数。
- `favoriteSeries` / `favoriteVersions`：该用户的收藏数（原型「收藏系列 8」）。
- `comments`：该用户发表的评论数（含回复）。
- `edits`：该用户产生的修订记录数（体现贡献量）。

统计只算公开对象；草稿一律不计。响应不包含 `email`、`status`、`token_version` 等敏感字段。

### 贡献列表

`GET /api/users/{userId}/contributions?type=VERSION&page=0&size=20`

公开接口。列出该用户参与的公开对象。

- `type`：`VERSION`（默认）、`SERIES`、`COMMENT`。
- 排序：按该用户最近一次动作时间倒序。
- 匿名访问只返回已发布对象；草稿贡献不出现。

`type=VERSION` 响应：

```json
{
  "items": [
    {
      "type": "VERSION",
      "version": {
        "id": "版本 UUID",
        "versionNumber": "9.9",
        "platform": "WINDOWS",
        "status": "PUBLISHED",
        "updatedAt": "2026-10-27T08:00:00Z"
      },
      "series": { "id": "系列 UUID", "name": "QQ" },
      "role": "CREATOR",
      "lastActionAt": "2026-10-27T08:00:00Z"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1
}
```

- `role`：`CREATOR`（创建者）或 `EDITOR`（编辑者）；两者都有时为 `CREATOR`。
- `type=SERIES` 返回 `series` 完整卡片字段；`type=COMMENT` 返回 `{comment: {...}, version: {...}, series: {...}}`。
- 只返回该用户有贡献的对象，去重后按 `lastActionAt` 倒序。

### 我的发布与创建的系列

个人主页的「我的发布 / 我创建的系列」使用本人视角的贡献列表：

`GET /api/me/contributions?type=VERSION|SERIES&page=0&size=20`

需要登录 Cookie。与 `GET /api/users/{id}/contributions` 结构相同，区别是包含当前用户自己的草稿（`role` 语义同上，草稿项 `draft: true`）。

- 个人主页的「发布内容」「创建系列」数字取 `stats.publishedVersions`、`stats.createdSeries`；
- 「草稿箱（2）」数字取 `GET /api/me/drafts` 的 `totalElements`（见 [草稿接口](drafts-api.md)）；
- 「收藏系列 8」取 `stats.favoriteSeries`，列表见 [收藏接口](favorites-api.md)。

## 权限与可见性

| 数据 | 匿名 | 登录（非本人） | 本人 |
| --- | --- | --- | --- |
| 公开档案（显示名、简介、头像、统计） | 可见 | 可见 | 可见 |
| `email` | 不可见 | 不可见 | 仅 `GET /api/auth/me` |
| 修改资料、头像 | 拒绝 | 拒绝 | 允许 |
| 贡献列表中的草稿 | 不可见 | 不可见 | 可见（`/api/me/contributions`） |

- 用户名是公开昵称，允许出现在档案与评论作者信息里；邮箱永不对外。
- 不提供「谁编辑了什么」的实时通知，贡献只通过档案与对象修订页展示。

## 错误

| 状态 | code | 场景 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 显示名/简介超长、头像格式或尺寸错误、类型错误 |
| 401 | `AUTH_REQUIRED` / `TOKEN_INVALID` / `TOKEN_EXPIRED` / `AUTH_INVALID` | 未登录或凭据失效 |
| 403 | `REQUEST_FORBIDDEN` | 写请求缺少 Origin 或 `X-App-Request` |
| 404 | `USER_NOT_FOUND` / `AVATAR_NOT_FOUND` | 用户不存在（或已禁用）、未设置头像 |
| 413 | `UPLOAD_TOO_LARGE` | 头像超过 2 MiB 或请求体超过 6 MiB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 非 multipart 请求 |

## 实施影响

- 新增路径：`PATCH /api/me/profile`、`POST|DELETE /api/me/avatar`、`GET /api/users/{id}/avatar`、`GET /api/users/{id}`、`GET /api/users/{id}/contributions`、`GET /api/me/contributions`。`GET /api/users/{id}` 与头像需匿名放行，其余要求登录。
- `PATCH`、`DELETE` 加入 CORS 方法白名单；`/api/me/**` 的写请求需要 Origin + `X-App-Request` 校验（`BusinessRequestPaths` 扩展）。
- 新增上传目录 `data/uploads/avatars/`，配置项 `museum.storage.avatars`，与图标、截图目录一起备份。
- `app_users` 的查询投影需要区分「本人视图」与「公开视图」，避免邮箱泄露；建议用独立的 `PublicUserView` 记录类型。
- 评论、修订、贡献者列表中的作者信息统一走 `PublicUserView`（`id`、`displayName`、`avatarUrl`），保证一处改动全局生效。
- `GET /api/auth/me` 响应追加字段属于向后兼容扩展，前端可先忽略。

## 前端联调示例

```javascript
// 保存资料
await fetch('/api/me/profile', {
  method: 'PATCH', credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'X-App-Request': 'museum-web' },
  body: JSON.stringify({ displayName: '老周', bio: '记录和分享软件资料。' })
});

// 上传头像（自动替换旧图）
const form = new FormData();
form.append('image', file);
await fetch('/api/me/avatar', {
  method: 'POST', credentials: 'include',
  headers: { 'X-App-Request': 'museum-web' }, body: form
});

// 公开档案：头像地址为空时用占位图
const profile = await fetch(`/api/users/${userId}`).then(r => r.json());
```

个人主页顶部的「编辑资料」只影响本人，不刷新他人页面缓存；`avatarUrl` 固定，替换后配合 `no-store` 即时生效。

## 本次不包含

- 修改用户名、修改邮箱、邮箱换绑。
- 个人主页自定义背景、社交链接、隐私开关。
- 关注/粉丝、私信、动态流。
- 账号注销与数据导出。
- 头像裁剪框（前端可先上传原图，服务端只缩放编码）。
