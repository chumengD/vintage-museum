# 编辑、删除与修改历史接口

原型把「多人共同维护」作为核心卖点：内容详情页有「编辑本版本」「查看修改历史」「贡献者：用户 A、用户 B、用户 C　查看全部」，发布版本页底部写明「发布后支持多人共同修改，并保留贡献与修改记录」。

设计取向是维基式协作：**任何登录用户都可以编辑已发布的系列和版本，每次编辑都留下修订记录；删除只允许创建者。** 草稿只有属主可见可改，编辑草稿不产生公开修订。

相关文档：[总览与约定](api-overview.md)、[草稿接口](drafts-api.md)、[标签与来源接口](tags-source-icon-api.md)、[系列接口](series-api.md)、[版本接口](version-api.md)。

## 数据模型

### V8 `content_revisions`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID | 主键 |
| `target_type` | VARCHAR(16) | `SERIES` 或 `VERSION` |
| `target_id` | UUID | 被编辑对象 |
| `revision_no` | INT | 同一对象内递增，从 1 开始 |
| `editor_id` | UUID | 编辑者 |
| `changes` | TEXT | JSON 数组 `[{field, oldValue, newValue}]` |
| `note` | VARCHAR(200) | 可选编辑说明 |
| `created_at` | TIMESTAMP | 编辑时间 |

- 唯一键 `(target_type, target_id, revision_no)`；同一对象的 `revision_no` 由业务层在事务内取当前最大值加一，并发冲突重试一次，仍冲突返回 409。
- 索引 `(target_type, target_id, revision_no DESC)` 支持倒序分页。
- `changes` 只记录真正变化的字段；未变化的字段不出现在数组里。旧值/新值均为人类可读文本（平台代码转中文名、标签数组用顿号连接、`null` 记为 `null`）。
- 修订随对象删除级联删除；不做软删除与回收站。

### 版本字段扩展（V12）

编辑接口涉及版本的完整字段集，汇总如下（均由 [标签与来源接口](tags-source-icon-api.md) 定义语义）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `versionNumber` | VARCHAR(100) NULL | `numberStatus=EXACT` 时的版本号 |
| `numberStatus` | VARCHAR(16) | `EXACT` / `RANGE` / `UNKNOWN` |
| `numberText` | VARCHAR(100) NULL | `RANGE` 时的范围文本，如 `1.2—1.4` |
| `normalizedNumber` | VARCHAR(100) NULL | 去空白转小写后的唯一键，`UNKNOWN` 时为 `null` |
| `releaseDate` | DATE NULL | `dateStatus=EXACT` 时的日期 |
| `dateStatus` | VARCHAR(16) | `EXACT` / `RANGE` / `UNKNOWN` |
| `releaseDateText` | VARCHAR(100) NULL | `RANGE` 时的文本，如 `2001—2002 年` |
| `platform` | VARCHAR(16) | 必填，必须属于系列平台 |
| `platformText` | VARCHAR(100) NULL | 平台补充说明，如 `Windows，具体版本暂缺` |
| `body` | TEXT NULL | 正文 Markdown，≤20000 字符 |
| `description` | VARCHAR(5000) NULL | 保留的纯文本简介，与 `body` 二选一或并存，前端优先 `body` |
| `sourceUrl` | VARCHAR(500) NULL | 资料来源链接 |
| `sourceNote` | VARCHAR(200) NULL | 来源说明，如「由贡献者提供」 |
| `iconStorageKey` | VARCHAR(100) NULL | 版本自定义图标，见版本图标接口 |

唯一键为 `(series_id, platform, normalized_number, status)`。`normalized_number` 为 `null` 时不参与唯一性判断（H2 允许多行 NULL），因此「版本号暂缺」的版本可以有多条。

## 接口

### 编辑系列

`PATCH /api/series/{seriesId}`

需要登录 Cookie、白名单 `Origin`、`X-App-Request: museum-web`、`Content-Type: application/json`。任何登录用户可编辑已发布系列；草稿只有属主可编辑，其他人 404。

请求体为部分更新，只传需要改的字段：

```json
{
  "name": "QQ 软件系列",
  "description": "收集 QQ 各平台的历史版本、截图与界面变化。",
  "category": "INSTANT_MESSAGING",
  "platforms": ["WINDOWS", "ANDROID"],
  "sourceUrl": "https://im.qq.com/",
  "tags": ["聊天", "社交", "腾讯"],
  "note": "补充官网链接",
  "expectedUpdatedAt": "2026-10-27T08:00:00Z"
}
```

- `name`：1～100 字符，转小写后唯一；改名与已有系列冲突返回 409 `SERIES_ALREADY_EXISTS`。
- `description`：1～1000 字符，不允许清空。
- `category`：四个分类代码之一；`platforms`：非空、不重复、最多 6 个，且必须是 `WINDOWS`、`ANDROID`、`IOS`、`MACOS`、`LINUX`、`OTHER`。
- 删除系列已有版本使用的平台：返回 400 `VALIDATION_ERROR`，`fieldErrors.platforms` 说明冲突的平台；不允许让既有版本落在系列平台之外。
- `sourceUrl`：可选，`http://` 或 `https://` 开头，≤500 字符；传 `null` 或空串表示清除。
- `tags`：整个数组替换语义，最多 10 个，单个 1～20 字符；`[]` 表示清空。标签自动创建规则见 [标签与来源接口](tags-source-icon-api.md)。
- `note`：可选，≤200 字符，写入修订记录，不影响对象字段。
- `expectedUpdatedAt`：可选；与当前 `updatedAt` 不一致返回 409 `CONCURRENT_MODIFICATION`，不写入。
- 没有实际变化（所有字段与当前相同）时返回 200，但不写修订、不更新 `updatedAt`。

成功返回 `200`：

```json
{
  "series": {
    "id": "系列 UUID",
    "name": "QQ 软件系列",
    "description": "收集 QQ 各平台的历史版本、截图与界面变化。",
    "category": "INSTANT_MESSAGING",
    "platforms": ["ANDROID", "WINDOWS"],
    "iconUrl": "/api/series/系列UUID/icon",
    "sourceUrl": "https://im.qq.com/",
    "tags": ["聊天", "社交", "腾讯"],
    "status": "PUBLISHED",
    "createdBy": "用户 UUID",
    "createdAt": "2026-10-29T08:00:00Z",
    "updatedAt": "2026-10-30T08:00:00Z"
  },
  "revision": {
    "id": "修订 UUID",
    "revisionNo": 2,
    "createdAt": "2026-10-30T08:00:00Z"
  }
}
```

### 编辑版本

`PATCH /api/versions/{versionId}`

请求头同上。任何登录用户可编辑已发布版本；草稿仅属主。

```json
{
  "numberStatus": "RANGE",
  "numberText": "1.2—1.4",
  "dateStatus": "RANGE",
  "releaseDateText": "2001—2002 年",
  "platformText": "Windows，具体版本暂缺",
  "body": "# 1.2\n\n主界面、聊天窗口与设置页的截图与说明。",
  "sourceUrl": "https://example.com/qq-1.2",
  "sourceNote": "由贡献者提供",
  "tags": ["界面", "经典版"],
  "note": "补充版本范围"
}
```

三态字段校验（`numberStatus`、`dateStatus` 均适用）：

- `EXACT`：`versionNumber`（或 `releaseDate`）必填且格式合法，对应文本字段必须为 `null` 或空。
- `RANGE`：对应文本字段必填，1～100 字符；`versionNumber`、`releaseDate` 必须为 `null`。
- `UNKNOWN`：两个值字段与文本字段都必须为 `null`；`normalized_number` 置空。
- 只改 `versionNumber` 不改 `numberStatus` 时，按字段自身校验：`numberStatus=EXACT` 才允许写 `versionNumber`。
- 状态切换后必须满足目标状态的完整要求，否则 400 并在 `fieldErrors` 指明缺哪个字段。

其他规则：

- `platform`：必填且属于系列平台；`UNKNOWN` 语义通过选择 `OTHER` + `platformText` 表达，不允许 `platform` 为空。
- `body`：≤20000 字符，允许 Markdown 源文本，服务端不渲染；与 `description` 同时存在时前端优先 `body`。
- `sourceUrl` 校验同系列；`sourceNote` ≤200 字符。
- 版本号唯一性：同系列、同平台、同 `status`、非空 `normalized_number` 冲突时 409 `VERSION_ALREADY_EXISTS`。
- `expectedUpdatedAt`、`note` 语义同系列编辑。
- 编辑不改 `createdBy`、`createdAt`、`publishedAt`，只更新 `updatedAt` 与所属系列的 `updatedAt`。

成功返回 `200`，结构与版本详情一致，外加 `revision`：

```json
{
  "version": {
    "id": "版本 UUID",
    "seriesId": "系列 UUID",
    "versionNumber": null,
    "numberStatus": "RANGE",
    "numberText": "1.2—1.4",
    "releaseDate": null,
    "dateStatus": "RANGE",
    "releaseDateText": "2001—2002 年",
    "platform": "WINDOWS",
    "platformText": "Windows，具体版本暂缺",
    "body": "# 1.2 ...",
    "sourceUrl": "https://example.com/qq-1.2",
    "sourceNote": "由贡献者提供",
    "iconUrl": null,
    "iconSource": "SERIES",
    "status": "PUBLISHED",
    "updatedAt": "2026-10-30T08:00:00Z"
  },
  "revision": { "id": "修订 UUID", "revisionNo": 3, "createdAt": "2026-10-30T08:00:00Z" }
}
```

### 删除系列

`DELETE /api/series/{seriesId}`

需要登录 Cookie 与写请求头。仅创建者可删除，其他人 403 `NOT_RESOURCE_OWNER`。

- 系列下存在任何版本（含草稿）时返回 409 `SERIES_NOT_EMPTY`，需先删除版本。
- 删除成功返回 `204`，并级联删除系列图标文件、收藏、标签关联、修订记录。
- 不提供软删除或恢复。

### 删除版本

`DELETE /api/versions/{versionId}`

仅创建者可删除，规则同上。成功返回 `204`，级联删除：

- 截图记录与磁盘图片文件；
- 全部评论与回复；
- 收藏记录；
- 标签关联与修订记录；
- 版本图标文件。

删除后更新所属系列 `updatedAt`。

### 修改历史

`GET /api/series/{seriesId}/revisions?page=0&size=20`
`GET /api/versions/{versionId}/revisions?page=0&size=20`

公开接口。按 `revision_no` 倒序（最新在前），分页结构同通用约定。响应：

```json
{
  "items": [
    {
      "id": "修订 UUID",
      "revisionNo": 3,
      "editor": { "id": "用户 UUID", "displayName": "用户 B", "avatarUrl": null },
      "changes": [
        { "field": "releaseDateText", "oldValue": null, "newValue": "2001—2002 年" },
        { "field": "body", "oldValue": null, "newValue": "# 1.2 ..." }
      ],
      "note": "补充版本范围",
      "createdAt": "2026-10-30T08:00:00Z"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 3,
  "totalPages": 1
}
```

- 创建对象时写入 `revisionNo=1`，`changes` 为全部初始字段（`oldValue` 为 `null`），`note` 固定为 `创建`。
- 编辑草稿同样写修订，但修订列表对非属主不可见（404），避免泄露草稿内容。
- 修订列表不返回完整快照；需要单条详情时用下面的接口。

`GET /api/revisions/{revisionId}`

公开接口（对象为草稿时仅属主）。返回单条修订，结构与列表项一致，另带 `targetType`、`targetId` 与被编辑对象名称：

```json
{
  "revision": {
    "id": "修订 UUID",
    "targetType": "VERSION",
    "targetId": "版本 UUID",
    "targetLabel": "QQ 9.9 版本记录",
    "revisionNo": 3,
    "editor": { "id": "用户 UUID", "displayName": "用户 B", "avatarUrl": null },
    "changes": [{ "field": "releaseDateText", "oldValue": null, "newValue": "2001—2002 年" }],
    "note": "补充版本范围",
    "createdAt": "2026-10-30T08:00:00Z"
  }
}
```

### 贡献者

`GET /api/series/{seriesId}/contributors`
`GET /api/versions/{versionId}/contributors`

公开接口。按编辑次数倒序、最近编辑时间倒序。响应：

```json
{
  "items": [
    {
      "user": { "id": "用户 UUID", "displayName": "用户 A", "avatarUrl": "/api/users/用户UUID/avatar" },
      "editCount": 5,
      "lastEditedAt": "2026-10-30T08:00:00Z"
    }
  ],
  "totalContributors": 3
}
```

- 贡献者 = 该对象修订记录里的去重编辑者；创建者即使从未编辑也出现在列表（`editCount=1`，来自创建修订）。
- 默认返回全部（最多 50 条），不接受分页参数；原型「查看全部」直接展开。
- 公开档案页的贡献列表见 [资料接口](profile-api.md)。

## 权限与可见性

| 对象 | 编辑 | 删除 | 查看修订/贡献者 |
| --- | --- | --- | --- |
| 已发布系列 | 任意登录用户 | 仅创建者 | 公开 |
| 已发布版本 | 任意登录用户 | 仅创建者 | 公开 |
| 草稿系列/版本 | 仅属主 | 仅属主 | 仅属主，他人 404 |

维基式编辑的风险由修订记录兜底：任何改动都可追溯到人与时间，后续可基于修订实现回滚（本次不做）。

## 错误

| 状态 | code | 场景 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 字段格式/长度/枚举错误、三态字段组合不完整、删除版本已使用的平台、URL 非法、`note` 超长 |
| 401 | `AUTH_REQUIRED` / `TOKEN_INVALID` / `TOKEN_EXPIRED` / `AUTH_INVALID` | 未登录或凭据失效 |
| 403 | `REQUEST_FORBIDDEN` | 写请求缺少 Origin 或 `X-App-Request` |
| 403 | `NOT_RESOURCE_OWNER` | 非创建者删除对象 |
| 404 | `SERIES_NOT_FOUND` / `VERSION_NOT_FOUND` / `REVISION_NOT_FOUND` | 对象不存在、已删除或为他人草稿 |
| 409 | `SERIES_ALREADY_EXISTS` / `VERSION_ALREADY_EXISTS` | 改名或改版本号后冲突 |
| 409 | `SERIES_NOT_EMPTY` | 系列仍有版本时删除 |
| 409 | `CONCURRENT_MODIFICATION` | `expectedUpdatedAt` 不匹配，或修订号并发冲突 |
| 413 | `UPLOAD_TOO_LARGE` | 图标等上传超限（见图标接口） |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 非 JSON 请求 |

## 实施影响

- 新增 `PATCH`、`DELETE` 路径：`/api/series/{id}`、`/api/versions/{id}`、`/api/revisions/{id}`、`/api/series/{id}/revisions`、`/api/versions/{id}/revisions`、贡献者两个路径。CORS 必须加入 `PATCH`、`DELETE`；CSRF 豁免需覆盖非 GET 写请求。
- `BusinessRequestPaths` 当前按「创建路径」枚举，PATCH/DELETE 不在其中。实现时应改为「所有非 GET 且非 auth 的请求」统一要求 Origin 与 `X-App-Request`，否则编辑接口可被跨站调用。
- 修订写入与对象更新必须在同一事务；`changes` 的 `field` 使用驼峰字段名，前端按字段名渲染中文标签（`versionNumber` → 「版本号」等）。
- 版本唯一键在 V9 改为含 `status`，编辑已发布版本改版本号时需要同时校验同 `status` 的冲突。
- 删除版本涉及磁盘文件（截图、版本图标）与多表级联，顺序：事务内删记录，提交后删文件；文件删除失败只记日志，不回滚。

## 前端联调示例

```javascript
// 编辑版本，带并发控制
async function saveVersion(versionId, patch) {
  const response = await fetch(`/api/versions/${versionId}`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-App-Request': 'museum-web' },
    body: JSON.stringify(patch)
  });
  if (response.status === 409) {
    const error = await response.json();
    if (error.code === 'CONCURRENT_MODIFICATION') {
      return { conflict: true }; // 提示「他人刚修改过，刷新后重试」
    }
    throw new Error(error.code);
  }
  return response.json();
}

// 修改历史
const history = await fetch(`/api/versions/${versionId}/revisions?page=0&size=20`)
  .then(r => r.json());
```

编辑成功后用响应里的 `revision.revisionNo` 提示「已保存为第 N 次修改」，并刷新 `updatedAt`。

## 本次不包含

- 修订回滚/撤销、字段级 diff 高亮。
- 编辑审批、半保护页面、锁定。
- 编辑冲突三方合并。
- 管理员强制删除与批量操作。
- 对象别名、重定向（改名后旧名称不保留跳转）。
