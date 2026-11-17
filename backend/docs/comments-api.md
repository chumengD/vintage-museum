# 评论与回复接口

内容详情页底部的「用户讨论」区：显示讨论总数、输入框、顶层评论列表、每条评论下的回复、以及「加载更多讨论」。原型只做了两层：顶层评论 + 回复，回复不再被回复。

相关文档：[总览与约定](api-overview.md)、[版本接口](version-api.md)、[编辑接口](editing-api.md)。

## 数据模型

V7 迁移新增 `version_comments`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID | 主键 |
| `version_id` | UUID | 所属版本，外键 `software_versions` |
| `parent_id` | UUID NULL | 回复的顶层评论；顶层评论为 `null` |
| `author_id` | UUID | 作者，外键 `app_users` |
| `content` | VARCHAR(1000) | 纯文本，去首尾空白 |
| `created_at` | TIMESTAMP | 创建时间，UTC |
| `updated_at` | TIMESTAMP | 目前只用于删除标记，与创建时间相同 |

约束与索引：

- `parent_id` 必须指向同一 `version_id` 下 `parent_id IS NULL` 的评论，由业务层校验，不建自引用外键。
- 索引 `(version_id, parent_id, created_at)`：顶层分页与回复列表共用。
- 评论不软删除，删除即物理删除，连带删除其全部回复；版本删除时级联删除评论。

## 接口

### 顶层评论列表

`GET /api/versions/{versionId}/comments?page=0&size=20&sort=OLDEST`

公开接口，无需登录。`versionId` 不存在或为草稿时返回 404 `VERSION_NOT_FOUND`。

- `sort`：`OLDEST`（默认，按创建时间正序）或 `NEWEST`；其他值 400。
- 分页针对顶层评论，`totalElements` 是顶层评论数，不是含回复的总数。
- 每条顶层评论内联最多 20 条回复（按创建时间正序），并给出 `replyCount`；超过 20 条时前端用「查看全部回复」调用下面的回复接口。

```json
{
  "items": [
    {
      "id": "评论 UUID",
      "versionId": "版本 UUID",
      "parentId": null,
      "content": "这张截图的时间是否能进一步确认？",
      "author": {
        "id": "用户 UUID",
        "displayName": "用户 A",
        "avatarUrl": "/api/users/用户UUID/avatar"
      },
      "createdAt": "2026-10-27T08:00:00Z",
      "replyCount": 1,
      "replies": [
        {
          "id": "回复 UUID",
          "versionId": "版本 UUID",
          "parentId": "评论 UUID",
          "content": "目前只能确认大概范围，可以继续补充来源。",
          "author": {
            "id": "用户 UUID",
            "displayName": "用户 B",
            "avatarUrl": null
          },
          "createdAt": "2026-10-27T09:00:00Z",
          "replyCount": 0,
          "replies": []
        }
      ]
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1,
  "totalComments": 2
}
```

`totalComments` 是包含回复的总数，用于页面标题「用户讨论 (N)」。`avatarUrl` 为 `null` 表示未设置头像，前端显示默认占位；`displayName` 为空时回退 `username`（见 [资料接口](profile-api.md)）。

### 回复列表

`GET /api/comments/{commentId}/replies?page=0&size=20`

公开接口。`commentId` 必须是顶层评论，否则 404 `COMMENT_NOT_FOUND`；顶层评论本身可以没有回复，返回空列表。按创建时间正序，响应结构同上（`items` 元素为回复对象，`replies` 为空数组）。

### 发表评论

`POST /api/versions/{versionId}/comments`

需要登录 Cookie、白名单 `Origin`、`X-App-Request: museum-web`、`Content-Type: application/json`。

```json
{
  "content": "我印象里这个界面在 2002 年也出现过。",
  "parentId": null
}
```

- `content`：必填，去首尾空白后 1～1000 个 UTF-16 字符；空白内容 400。纯文本，不支持 Markdown/HTML，前端按文本渲染（保留换行）。
- `parentId`：可选。省略或 `null` 表示顶层评论；填写时必须是**同一版本**的顶层评论 ID，否则 400 `COMMENT_PARENT_INVALID`。指向回复、指向其他版本、指向已删除评论都返回该错误。
- 不接受其他字段；作者取自登录用户，不能由客户端指定。
- 版本不存在或为草稿：404 `VERSION_NOT_FOUND`。

成功返回 `201`，`Location: /api/comments/{id}`，响应：

```json
{
  "comment": {
    "id": "评论 UUID",
    "versionId": "版本 UUID",
    "parentId": null,
    "content": "我印象里这个界面在 2002 年也出现过。",
    "author": { "id": "用户 UUID", "displayName": "用户 A", "avatarUrl": null },
    "createdAt": "2026-10-30T08:00:00Z",
    "replyCount": 0,
    "replies": []
  }
}
```

发布成功后更新版本的 `updatedAt`（讨论也算内容变更），不改变版本的 `published_at`。

### 删除评论

`DELETE /api/comments/{commentId}`

需要登录 Cookie 与写请求头。只有评论作者可以删除；其他人返回 403 `NOT_RESOURCE_OWNER`。评论不存在返回 404 `COMMENT_NOT_FOUND`。

- 删除顶层评论连带删除其全部回复，返回 `204 No Content`。
- 删除回复只删除该条，父评论的 `replyCount` 减一。
- 删除后不保留占位「该评论已删除」，讨论总数同步减少。

## 权限与可见性

- 浏览公开，不要求登录；但草稿版本的评论区对非属主不可见（404）。
- 发表与删除要求登录；删除仅作者本人，管理员能力不在本次范围。
- 评论内容公开可见，作者信息只暴露 `id`、`displayName`、`avatarUrl`，不暴露邮箱。

## 错误

| 状态 | code | 场景 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 内容为空或超长、`sort` 非法、分页或 UUID 错误 |
| 400 | `COMMENT_PARENT_INVALID` | 父评论不存在、跨版本、本身是回复或已删除 |
| 401 | `AUTH_REQUIRED` / `TOKEN_INVALID` / `TOKEN_EXPIRED` / `AUTH_INVALID` | 未登录或凭据失效 |
| 403 | `REQUEST_FORBIDDEN` | 写请求缺少白名单 Origin 或 `X-App-Request` |
| 403 | `NOT_RESOURCE_OWNER` | 删除他人评论 |
| 404 | `VERSION_NOT_FOUND` / `COMMENT_NOT_FOUND` | 版本或评论不存在、版本为草稿 |
| 409 | `CONCURRENT_MODIFICATION` | 评论在删除过程中被并发修改（罕见） |

## 实施影响

- 新增路径：`GET /api/versions/{id}/comments`、`GET /api/comments/{id}/replies`、`POST /api/versions/{id}/comments`、`DELETE /api/comments/{id}`。GET 放行匿名；POST/DELETE 要求登录。
- `POST /api/versions/{id}/comments` 是新的创建路径，必须加入 `BusinessRequestPaths` 的创建路径识别，否则缺少 `X-App-Request` 也能写入。
- `DELETE` 是新动词，需加入 CORS 方法白名单与 CSRF 豁免规则。
- 版本详情响应增加 `commentCount`（含回复）；列表接口不返回评论，避免 N+1。
- 评论作者信息涉及 `app_users.display_name`、`avatar_storage_key`，依赖 V10 迁移；若先做评论再补资料字段，`displayName` 回退 `username`、`avatarUrl` 恒为 `null`。

## 前端联调示例

```javascript
// 发评论 / 回复
async function postComment(versionId, content, parentId = null) {
  const response = await fetch(`/api/versions/${versionId}/comments`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-App-Request': 'museum-web' },
    body: JSON.stringify({ content, parentId })
  });
  if (!response.ok) throw new Error((await response.json()).code);
  return response.json();
}

// 讨论区首屏：顶层评论 + 内联回复
async function loadDiscussion(versionId, page = 0) {
  const response = await fetch(
    `/api/versions/${versionId}/comments?page=${page}&size=20&sort=OLDEST`,
    { credentials: 'include' }
  );
  return response.json(); // items[].replies、totalComments
}
```

`totalComments` 用于「用户讨论 (N)」标题；回复超过 20 条时显示「查看全部回复」，再调用 `GET /api/comments/{id}/replies`。

## 本次不包含

- 点赞、举报、屏蔽用户、敏感词审核。
- 评论编辑与编辑历史。
- @ 提及、通知、订阅讨论。
- 富文本/Markdown、图片或附件评论。
- 管理员批量删除与恢复。
