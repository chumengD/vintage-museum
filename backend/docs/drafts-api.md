# 草稿与发布接口

原型中「创建系列」「添加内容」「发布版本」三个页面都有「保存草稿 / 预览 / 发布」三个按钮，个人主页有「草稿箱（2）」子 tab 和「继续编辑 / 删除」操作。草稿的价值是：资料一时查不全也能先存下来，之后再补。

设计上草稿不是独立实体，而是**系列与版本的 `status` 状态**：`DRAFT` 或 `PUBLISHED`。草稿复用同一套字段、同一套图标/截图/标签上传能力，发布只是补齐校验并改状态。这样不需要维护两套表，也不会出现「草稿转发布时字段对不上」的问题。

相关文档：[总览与约定](api-overview.md)、[编辑接口](editing-api.md)、[标签与来源接口](tags-source-icon-api.md)、[系列接口](series-api.md)、[版本接口](version-api.md)。

## 数据模型

V9 迁移给 `software_series`、`software_versions` 增加：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `status` | VARCHAR(16) | `DRAFT` / `PUBLISHED`，默认 `PUBLISHED`（保证历史数据已发布） |
| `published_at` | TIMESTAMP NULL | 首次发布时间；草稿为 `null`，历史数据回填为 `created_at` |

同时调整唯一键：

- 系列：`normalized_name` 唯一改 `(normalized_name, status)`。草稿可以与已发布系列同名，发布时再校验。
- 版本：`(series_id, platform, normalized_number)` 唯一改 `(series_id, platform, normalized_number, status)`。草稿之间可重名。

草稿还要表达「五项必须显式选择」中的图标与截图，V12 增加：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `icon_choice` | VARCHAR(16) | `INHERIT` / `UPLOAD` / `NONE`，默认 `INHERIT` |
| `screenshots_omitted` | BOOLEAN | 是否明确选择「截图暂缺」，默认 `false` |

`icon_choice` 与 `icon_storage_key` 的关系：`INHERIT` 时不存版本图标、沿用系列图标；`UPLOAD` 时必须有 `icon_storage_key`；`NONE` 时明确显示占位图。响应中的 `iconSource` 由它推导（`VERSION` / `SERIES` / `NONE`）。

## 接口

### 创建草稿

沿用现有创建接口，在 `metadata` / 请求体中加 `status`：

`POST /api/series`（multipart，`metadata.status = "DRAFT"`）

`POST /api/series/{seriesId}/versions`（JSON，`"status": "DRAFT"`）

草稿的校验比发布宽松：

- 系列：`name` 仍必填（去空白 1～100 字符，用于草稿箱展示）；`description`、`category`、`platforms` 可缺省；`platforms` 可传空数组。
- 版本：`platform` 仍必填（版本链分组依赖它，且必须属于系列平台，若系列尚未选择平台则允许任意合法平台代码，发布时再收紧）；其余字段均可缺省。
- 草稿创建成功返回 `201`，`status` 为 `"DRAFT"`，`publishedAt` 为 `null`。
- 草稿不能被其他人看到：`GET /api/series/{id}`、`GET /api/versions/{id}` 对非属主返回 404 `SERIES_NOT_FOUND` / `VERSION_NOT_FOUND`；列表接口、搜索、统计、收藏一律不返回草稿。

### 修改草稿

`PATCH /api/series/{id}`、`PATCH /api/versions/{id}`，字段与规则见 [编辑接口](editing-api.md)，唯一区别是草稿的校验按上面的宽松规则执行，且只有属主可以调用。

草稿也写修订记录，但修订列表对非属主 404，避免通过修订反推草稿内容。

### 发布

`POST /api/series/{id}/publish`
`POST /api/versions/{id}/publish`

需要登录 Cookie、白名单 `Origin`、`X-App-Request: museum-web`。无请求体。只有草稿属主可以发布，其他人 403 `NOT_RESOURCE_OWNER`；对象不存在或非属主 404。

发布前置校验（不满足返回 400 `DRAFT_INCOMPLETE`，`fieldErrors` 逐项列出）：

系列：

- `name` 1～100 字符；
- `description` 1～1000 字符；
- `category` 为四个分类代码之一；
- `platforms` 非空、不重复、≤6；
- 名称在该状态下的已发布系列中不冲突，冲突返回 409 `SERIES_ALREADY_EXISTS`。

版本（原型「以下五项都必须设置：提供资料、设置范围，或明确选择暂缺」）：

| 项目 | 满足条件 |
| --- | --- |
| 版本号 | `numberStatus=EXACT` 且有 `versionNumber`；或 `RANGE` 且有 `numberText`；或 `UNKNOWN`（明确暂缺） |
| 版本时间 | `dateStatus=EXACT` 且有 `releaseDate`（YYYY-MM-DD）；或 `RANGE` 且有 `releaseDateText`；或 `UNKNOWN` |
| 平台 | `platform` 已设置且属于系列平台 |
| 图标 | `iconChoice` 为 `INHERIT`、`NONE`，或 `UPLOAD` 且已上传版本图标 |
| 截图 | 至少一张截图，或 `screenshotsOmitted=true` |

发布动作：

- 把 `status` 改为 `PUBLISHED`，首次发布写入 `published_at=now`；
- 重新执行版本号唯一性校验（同系列、同平台、非空 `normalized_number`、`PUBLISHED`）；
- 写一条修订，`note` 为 `发布`；
- 更新所属系列 `updatedAt`；
- 返回 `200`，响应为完整的对象（同详情），`status` 为 `PUBLISHED`。

```json
{
  "series": {
    "id": "系列 UUID",
    "name": "QQ 软件系列",
    "status": "PUBLISHED",
    "publishedAt": "2026-10-30T08:00:00Z",
    "updatedAt": "2026-10-30T08:00:00Z"
  }
}
```

已发布对象再次调用发布返回 409 `ALREADY_PUBLISHED`。发布不可逆：不提供「撤回为草稿」；需要隐藏内容时由创建者删除。

### 草稿箱

`GET /api/me/drafts?target=ALL&page=0&size=20`

需要登录 Cookie。只返回当前用户自己的草稿，按 `updatedAt` 倒序。

- `target`：`ALL`（默认）、`SERIES`、`VERSION`。
- 响应项统一为：

```json
{
  "items": [
    {
      "targetType": "VERSION",
      "id": "版本 UUID",
      "title": "未完成的资料整理",
      "series": { "id": "系列 UUID", "name": "QQ" },
      "category": "INSTANT_MESSAGING",
      "updatedAt": "2026-10-27T08:00:00Z",
      "missingFields": ["versionNumber", "screenshots"]
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 2,
  "totalPages": 1
}
```

- `title`：系列用 `name`；版本优先 `body` 第一行标题或 `versionNumber`，都没有时用「未命名版本」。
- `missingFields`：发布前仍缺的项目，取值 `versionNumber`、`releaseDate`、`platform`、`icon`、`screenshots`（系列为 `description`、`category`、`platforms`），供草稿箱显示「还差几项」。
- 草稿箱数量即 `totalElements`（原型「草稿箱（2）」）。

### 删除草稿

`DELETE /api/series/{id}`、`DELETE /api/versions/{id}`，仅属主，规则见 [编辑接口](editing-api.md)。草稿删除不触发 `SERIES_NOT_EMPTY`（草稿系列下的草稿版本一并删除）。

## 权限与可见性

- 草稿的可见范围只有属主：详情、修订、贡献者、草稿箱全部按登录用户过滤，其他人一律 404。
- 草稿不进入系列列表、版本列表、搜索结果、统计计数、收藏、公开档案贡献数。
- 发布是单向的；发布后按已发布对象规则参与所有公开查询。
- 属主删除已发布对象走编辑接口的删除规则，与草稿删除共用端点，区别只在状态。

## 错误

| 状态 | code | 场景 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 字段格式错误、分页/UUID 错误、草稿字段类型错误 |
| 400 | `DRAFT_INCOMPLETE` | 发布时必填项缺失，`fieldErrors` 列出缺失项 |
| 401 | `AUTH_REQUIRED` / `TOKEN_INVALID` / `TOKEN_EXPIRED` / `AUTH_INVALID` | 未登录或凭据失效 |
| 403 | `REQUEST_FORBIDDEN` | 写请求缺少 Origin 或 `X-App-Request` |
| 403 | `NOT_RESOURCE_OWNER` | 发布/修改/删除他人草稿 |
| 404 | `SERIES_NOT_FOUND` / `VERSION_NOT_FOUND` | 对象不存在、已删除或为他人草稿 |
| 409 | `SERIES_ALREADY_EXISTS` / `VERSION_ALREADY_EXISTS` | 发布时与已发布对象重名 |
| 409 | `ALREADY_PUBLISHED` | 对已发布对象重复发布 |
| 409 | `CONCURRENT_MODIFICATION` | `expectedUpdatedAt` 不匹配，或并发发布 |

## 实施影响

- `POST /api/series/{id}/publish`、`POST /api/versions/{id}/publish` 是新的创建型 POST，必须加入 `BusinessRequestPaths` 的请求防护识别。
- 现有查询方法（`SeriesService.list/detail`、`VersionService.list/detail`）需要默认过滤 `status='PUBLISHED'`，并新增「属主可见草稿」的分支。搜索、统计、收藏、评论、修订、贡献者的查询都要带同样过滤，漏一处就会泄露草稿。
- V9 的唯一键变更需要先清理历史重复数据（理论上不存在），H2 上通过 `ALTER TABLE ... DROP CONSTRAINT` + 新建复合唯一索引实现。
- 发布时写入 `published_at` 只做一次；`updatedAt` 每次修改都更新。
- 草稿箱 `missingFields` 由服务端计算，避免前端重复实现发布校验规则。

## 前端联调示例

```javascript
// 保存草稿（版本），再续编辑
async function saveDraft(seriesId, draft) {
  const response = await fetch(`/api/series/${seriesId}/versions`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-App-Request': 'museum-web' },
    body: JSON.stringify({ ...draft, status: 'DRAFT' })
  });
  return response.json(); // version.id、status=DRAFT
}

async function publishVersion(versionId) {
  const response = await fetch(`/api/versions/${versionId}/publish`, {
    method: 'POST', credentials: 'include',
    headers: { 'X-App-Request': 'museum-web' }
  });
  if (response.status === 400) {
    const error = await response.json();
    if (error.code === 'DRAFT_INCOMPLETE') {
      return { missing: Object.keys(error.fieldErrors) };
    }
  }
  return response.json(); // version.status=PUBLISHED
}

// 草稿箱
const drafts = await fetch('/api/me/drafts?target=ALL&page=0&size=20', {
  credentials: 'include'
}).then(r => r.json());
```

「预览」直接调用已发布详情接口 `GET /api/versions/{id}`（属主可读草稿），无需单独接口。

## 本次不包含

- 自动保存草稿（前端定时 PATCH 即可，无需专门接口）。
- 草稿预览的公开分享链接。
- 定时发布、发布审批。
- 撤回发布、版本回收站。
- 截图、评论的草稿状态。
