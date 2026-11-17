# 收藏接口

收藏让登录用户把感兴趣的系列或版本收进「我的收藏」。原型中首页卡片有「收藏」按钮，系列详情、内容详情页各有单个收藏按钮，个人主页的「收藏」页按「系列收藏 / 内容收藏」两个 tab 展示。

收藏对象只有两类：`SERIES`（系列）与 `VERSION`（版本，即原型中的「内容」）。只能收藏已发布对象；草稿不可收藏。取消收藏与收藏都是幂等操作，重复点击不会报错。

相关文档：[总览与约定](api-overview.md)、[系列接口](series-api.md)、[版本接口](version-api.md)、[草稿接口](drafts-api.md)。

## 数据模型

V6 迁移新增 `favorites`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID | 主键 |
| `user_id` | UUID | 收藏者，外键 `app_users` |
| `target_type` | VARCHAR(16) | `SERIES` 或 `VERSION` |
| `target_id` | UUID | 系列或版本 ID，不使用外键以保证两张表都能引用 |
| `created_at` | TIMESTAMP | 收藏时间，UTC |

约束与索引：

- 唯一键 `(user_id, target_type, target_id)`：同一用户对同一对象只能有一条记录，并发重复收藏由唯一键兜底。
- 索引 `(target_type, target_id)`：按对象统计收藏数。
- 索引 `(user_id, target_type, created_at DESC)`：我的收藏列表。

`target_id` 不做外键是刻意的：删除系列或版本时由业务层清理收藏记录，避免多态外键造成的迁移与级联复杂度。

## 接口

### 收藏系列

`PUT /api/series/{seriesId}/favorite`

需要登录 Cookie、白名单 `Origin`、`X-App-Request: museum-web`。没有请求体，`Content-Type` 不需要设置。

成功返回 `204 No Content`，无响应体。行为：

- 已收藏时直接返回 204，不产生第二条记录，也不刷新 `created_at`。
- 系列不存在、是草稿或已删除：404 `SERIES_NOT_FOUND`，不区分「不存在」与「不可见」。
- 未登录：401 `AUTH_REQUIRED`。

```javascript
await fetch(`/api/series/${seriesId}/favorite`, {
  method: 'PUT', credentials: 'include',
  headers: { 'X-App-Request': 'museum-web' }
});
```

### 取消收藏系列

`DELETE /api/series/{seriesId}/favorite`

请求头同上。成功返回 `204 No Content`；本来就没收藏也返回 204。系列不存在仍返回 404。

### 收藏/取消收藏版本

`PUT /api/versions/{versionId}/favorite`
`DELETE /api/versions/{versionId}/favorite`

规则与系列完全一致，对象不存在或为草稿返回 404 `VERSION_NOT_FOUND`。

### 我的收藏

`GET /api/me/favorites?target=SERIES&q=&page=0&size=20`

需要登录 Cookie。公开页面不提供「别人的收藏」。

参数：

- `target`：必填，`SERIES` 或 `VERSION`；其他值 400。
- `q`：可选，按名称（系列名或版本标题）子串过滤，去首尾空白后 1～100 字符；空字符串视为未传。
- `page`、`size`：同通用分页约定。

按收藏时间倒序，`id` 次级倒序。响应：

```json
{
  "items": [
    {
      "targetType": "SERIES",
      "favoritedAt": "2026-10-30T08:00:00Z",
      "series": {
        "id": "系列 UUID",
        "name": "QQ 软件系列",
        "description": "一款国民级聊天软件",
        "category": "INSTANT_MESSAGING",
        "platforms": ["WINDOWS", "ANDROID"],
        "iconUrl": "/api/series/系列UUID/icon",
        "tags": ["聊天", "社交"],
        "versionCount": 24,
        "favoriteCount": 8,
        "updatedAt": "2026-10-27T08:00:00Z",
        "status": "PUBLISHED"
      }
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1
}
```

`target=VERSION` 时每项为 `{targetType, favoritedAt, version: {...}, series: {id, name, iconUrl}}`，版本对象字段见 [版本接口](version-api.md) 与 [标签与来源接口](tags-source-icon-api.md)。列表中的对象若已被删除，直接跳过，不返回空洞项。

## 权限与可见性

- 收藏、取消收藏要求登录；GET 我的收藏只返回当前登录用户自己的记录。
- 只能收藏 `PUBLISHED` 对象；草稿对非属主是 404，因此「收藏草稿」表现为 404，不泄露草稿存在性。
- 收藏数对所有访客可见（卡片与详情页展示），但收藏人列表不公开。
- 删除系列/版本时，相关 `favorites` 记录在同一事务内删除；收藏页不显示已删除对象。

## 错误

| 状态 | code | 场景 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | `target` 非法、`q` 超长、分页参数或 UUID 格式错误 |
| 401 | `AUTH_REQUIRED` / `TOKEN_INVALID` / `TOKEN_EXPIRED` / `AUTH_INVALID` | 未登录或凭据失效 |
| 403 | `REQUEST_FORBIDDEN` | 写请求缺少白名单 Origin 或 `X-App-Request` |
| 404 | `SERIES_NOT_FOUND` / `VERSION_NOT_FOUND` | 对象不存在、已删除或为草稿 |
| 409 | `CONCURRENT_MODIFICATION` | 并发删除导致对象在事务提交前消失（少见，前端刷新即可） |

## 实施影响

- 新增写路径 `PUT|DELETE /api/series/{id}/favorite`、`PUT|DELETE /api/versions/{id}/favorite`，需加入 `SecurityConfig` 的显式放行，并把 `PUT`、`DELETE` 加入 CORS 方法白名单。
- 这两个方法属于新的 HTTP 动词，现有 `BusinessRequestPaths` 只识别 POST 创建路径，必须同步扩展，否则写请求会绕过 Origin/`X-App-Request` 校验。
- `GET /api/me/favorites` 需在 `SecurityConfig` 中放行为登录可访问；匿名访问返回 401，而不是 404。
- 系列列表与详情、版本列表与详情的响应需要追加 `favoriteCount` 与 `favoritedByMe`（见 [系列接口](series-api.md)、[版本接口](version-api.md)）；`favoritedByMe` 在带 Cookie 的请求中按当前用户计算，匿名恒为 `false`。
- 无需新增上传目录；V6 迁移后重启应用即可。

## 前端联调示例

```javascript
// 收藏按钮：先乐观更新，失败再回滚
async function toggleFavorite(seriesId, on) {
  const response = await fetch(`/api/series/${seriesId}/favorite`, {
    method: on ? 'PUT' : 'DELETE',
    credentials: 'include',
    headers: { 'X-App-Request': 'museum-web' }
  });
  if (response.status === 401) location.href = '/login';
  return response.ok; // 204 无响应体
}

// 我的收藏页
async function loadFavorites(target = 'SERIES', q = '') {
  const params = new URLSearchParams({ target, page: '0', size: '20' });
  if (q) params.set('q', q);
  const response = await fetch(`/api/me/favorites?${params}`, { credentials: 'include' });
  return response.json();
}
```

系列卡片需要的 `favoriteCount`、`favoritedByMe` 随 `GET /api/series` 返回，不需要额外请求。

## 本次不包含

- 收藏夹分组、公开收藏夹、收藏排序自定义。
- 收藏导出、批量取消收藏。
- 收藏数缓存与排行榜。
- 收藏人列表与「谁收藏了我」。
