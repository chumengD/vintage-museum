# 标签、来源与版本图标接口

原型里有三处相关需求：

1. 首页卡片与系列详情页显示分类标签，创建系列页有「标签」输入（例：聊天、社交、腾讯），发布页的可选标签。
2. 「资料来源」：创建系列有「软件官网 / 资料来源」，发布内容有「资料来源链接」，内容详情截图下有「截图说明 / 来源：由贡献者提供」。
3. 发布版本页「图标 *」三选一：沿用系列、上传版本图标、暂缺占位。

本文定义标签池、来源字段、版本自定义图标与截图补充字段；编辑接口如何调用这些字段见 [编辑接口](editing-api.md)。

相关文档：[总览与约定](api-overview.md)、[系列接口](series-api.md)、[版本接口](version-api.md)、[截图接口](screenshot-api.md)。

## 数据模型

### V11 标签

```
tags
  id            UUID PK
  name          VARCHAR(20)   原样大小写，展示用
  normalized_name VARCHAR(20) 去空白 + Locale.ROOT 小写，唯一
  created_at    TIMESTAMP

series_tags
  series_id UUID, tag_id UUID, PRIMARY KEY(series_id, tag_id)

version_tags
  version_id UUID, tag_id UUID, PRIMARY KEY(version_id, tag_id)
```

- 标签是全局池，多个系列/版本共用同一标签记录。
- 标签在编辑时按名懒创建：不存在就插入，大小写不同视为同一标签（`QQ` 与 `qq` 只保留首次创建时的 `name`）。
- 不提供用户侧的标签改名、合并、删除接口；标签没有引用后保留在池中（后续可加清理任务）。

### V12 来源与图标字段

`software_series` 增加：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `source_url` | VARCHAR(500) | 软件官网 / 资料来源链接 |

`software_versions` 增加：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `source_url` | VARCHAR(500) | 该版本的资料来源链接 |
| `source_note` | VARCHAR(200) | 来源说明，如「由贡献者提供」 |
| `icon_storage_key` | VARCHAR(100) | 版本自定义图标文件名 |
| `icon_choice` | VARCHAR(16) | `INHERIT` / `UPLOAD` / `NONE` |

`version_screenshots` 增加：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `source_text` | VARCHAR(200) | 截图来源，如「由贡献者提供」 |
| `time_text` | VARCHAR(100) | 截图时间范围，如「约 2001 年」 |

## 接口

### 标签列表与自动补全

`GET /api/tags?q=&limit=20`

公开接口。按使用次数倒序（同次数按名称正序）。

- `q`：可选，按名称子串匹配（大小写不敏感），1～20 字符；省略返回最常用的标签。
- `limit`：1～50，默认 20。

```json
{
  "items": [
    { "id": "标签 UUID", "name": "聊天", "usageCount": 12 },
    { "id": "标签 UUID", "name": "社交", "usageCount": 8 }
  ]
}
```

`usageCount` = 使用该标签的**已发布**系列数 + 已发布版本数；草稿不计。

标签的写入不单独提供接口：创建/编辑系列时传 `tags` 数组，创建/编辑版本时同样传 `tags`。语义是整体替换，不是追加。

规则：

- 最多 10 个，超出返回 400 `TAG_LIMIT_EXCEEDED`；
- 单个标签去首尾空白后 1～20 个 UTF-16 字符，不允许逗号、顿号（前端按回车/逗号切分后再提交）；
- 数组内重复（含大小写差异）自动去重，不报错；
- 传 `[]` 表示清空该对象的标签；
- 响应中的 `tags` 为字符串数组（按创建顺序），不返回 ID。

### 系列来源链接

创建系列时 `metadata.sourceUrl`、编辑系列时 `sourceUrl`：

- 可选，`http://` 或 `https://` 开头，≤500 字符；
- 传 `null` 或空串表示清除；
- 不校验可达性，不做 URL 抓取。

响应字段：系列对象增加 `"sourceUrl": "https://im.qq.com/"`（为空时 `null`）。

### 版本来源字段

创建/编辑版本时传：

```json
{
  "sourceUrl": "https://example.com/qq-1.2",
  "sourceNote": "由贡献者提供"
}
```

- `sourceUrl`：同系列链接规则。
- `sourceNote`：可选，≤200 字符，纯文本；用于「资料来源」的补充说明。
- 两者独立，可只填一个；都为空表示未提供来源。

版本详情响应增加 `sourceUrl`、`sourceNote`。若版本未填来源但系列有 `sourceUrl`，前端可以自行回退展示系列来源，服务端不做合并。

### 上传版本图标

`POST /api/versions/{versionId}/icon`

需要登录 Cookie、白名单 `Origin`、`X-App-Request: museum-web`。`multipart/form-data`，字段名 `image`。

- 真实 PNG/JPEG，非空，原文件 ≤2 MiB；
- 宽高均 ≤2048 像素，总像素 ≤400 万；
- 重新编码为 PNG，随机文件名，存 `data/uploads/version-icons/`；
- 上传成功把 `icon_choice` 置为 `UPLOAD`，并设置 `icon_storage_key`；替换旧图标时删除旧文件；
- 版本不存在或为他人草稿：404 `VERSION_NOT_FOUND`。

成功返回 `200`：

```json
{
  "version": {
    "id": "版本 UUID",
    "iconUrl": "/api/versions/版本UUID/icon",
    "iconSource": "VERSION",
    "updatedAt": "2026-10-30T08:00:00Z"
  }
}
```

上传图标同时写一条修订（`field=iconUrl`），并更新版本与所属系列的 `updatedAt`。

### 删除版本图标

`DELETE /api/versions/{versionId}/icon`

成功返回 `204`。行为是把图标选择恢复为 `INHERIT`（沿用系列图标），删除物理文件与 `icon_storage_key`；本来没有自定义图标也返回 204。若要显式「暂缺」，编辑版本时传 `iconChoice: "NONE"`。

### 读取版本图标

`GET /api/versions/{versionId}/icon`

公开接口，返回自定义图标 `image/png`；版本没有自定义图标返回 404 `ICON_NOT_FOUND`。前端不要直接依赖此地址做回退，应以版本详情响应中的 `iconUrl` 与 `iconSource` 为准：

| `iconSource` | 含义 | `iconUrl` |
| --- | --- | --- |
| `VERSION` | 使用版本自定义图标 | `/api/versions/{id}/icon` |
| `SERIES` | 沿用系列图标 | `/api/series/{seriesId}/icon`，系列无图标时为 `null` |
| `NONE` | 明确选择暂缺 | `null` |

系列图标缺失时 `iconSource=SERIES` 且 `iconUrl=null`，前端显示默认占位图。

### 修改截图说明与来源

`PATCH /api/screenshots/{screenshotId}`

需要登录 Cookie 与写请求头，`Content-Type: application/json`。

```json
{
  "caption": "主界面截图",
  "sourceText": "由贡献者提供",
  "timeText": "约 2001 年"
}
```

- `caption`：≤500 字符；`sourceText`：≤200 字符；`timeText`：≤100 字符；均为可选，传空串或 `null` 清除。
- 只改传入的字段；`{}` 合法但无改动。
- 截图不存在 404 `SCREENSHOT_NOT_FOUND`；草稿版本的截图仅属主可改，其他人 404。
- 成功返回 `200`，响应为截图对象，并写一条版本修订（`field=caption/sourceText/timeText`）。

截图对象新增字段：

```json
{
  "screenshot": {
    "id": "截图 UUID",
    "versionId": "版本 UUID",
    "imageUrl": "/api/screenshots/截图UUID/image",
    "caption": "主界面截图",
    "sourceText": "由贡献者提供",
    "timeText": "约 2001 年",
    "width": 1024,
    "height": 768,
    "createdBy": "用户 UUID",
    "createdAt": "2026-10-30T08:00:00Z"
  }
}
```

## 权限与可见性

- 标签列表、版本图标读取、系列/版本来源字段：公开。
- 上传/删除版本图标、修改截图说明：任意登录用户（维基式），仅草稿受属主限制。
- 标签只能通过系列/版本编辑写入，没有独立的「创建标签」接口，避免产生无人使用的空标签。
- 截图说明修改属于内容编辑，写修订，可追溯。

## 错误

| 状态 | code | 场景 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 标签超长/格式非法、URL 非法、说明超长、分页或 UUID 错误 |
| 400 | `TAG_LIMIT_EXCEEDED` | 单个对象标签超过 10 个 |
| 401 | `AUTH_REQUIRED` / `TOKEN_INVALID` / `TOKEN_EXPIRED` / `AUTH_INVALID` | 未登录或凭据失效 |
| 403 | `REQUEST_FORBIDDEN` | 写请求缺少 Origin 或 `X-App-Request` |
| 404 | `VERSION_NOT_FOUND` / `SCREENSHOT_NOT_FOUND` / `ICON_NOT_FOUND` | 版本、截图不存在或图标未设置 |
| 413 | `UPLOAD_TOO_LARGE` | 图标超过 2 MiB 或请求体超过 6 MiB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 非 multipart / 非 JSON |

## 实施影响

- 新增路径：`GET /api/tags`、`POST|DELETE|GET /api/versions/{id}/icon`、`PATCH /api/screenshots/{id}`。`PATCH` 需加入 CORS 方法白名单与 CSRF 豁免。
- 新增上传目录 `data/uploads/version-icons/`，配置项 `museum.storage.version-icons`。
- 版本详情/列表响应增加 `tags`、`sourceUrl`、`sourceNote`、`iconUrl`（改为按 `iconSource` 计算）、`iconSource`。现有 `series` 摘要里的 `iconUrl` 保持不变。
- 标签计数查询建议单独写聚合 SQL，不要在列表里 N+1。
- 迁移 V11 需要建三张表；V12 的列全部可空，历史数据无需回填。

## 前端联调示例

```javascript
// 标签输入：回车/逗号切分，最多 10 个
async function suggestTags(q) {
  const response = await fetch(`/api/tags?q=${encodeURIComponent(q)}&limit=20`);
  return (await response.json()).items;
}

// 带标签、来源创建版本（沿用 JSON 创建接口）
const created = await fetch(`/api/series/${seriesId}/versions`, {
  method: 'POST', credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'X-App-Request': 'museum-web' },
  body: JSON.stringify({
    versionNumber: '1.2', platform: 'WINDOWS', releaseDate: '2001-02-03',
    body: '# 1.2', sourceUrl: 'https://example.com/qq-1.2',
    sourceNote: '由贡献者提供', tags: ['界面', '经典版'], iconChoice: 'UPLOAD'
  })
}).then(r => r.json());

// 再单独上传版本图标（2 MiB 以内的 PNG/JPEG）
const form = new FormData();
form.append('image', iconFile);
await fetch(`/api/versions/${created.version.id}/icon`, {
  method: 'POST', credentials: 'include',
  headers: { 'X-App-Request': 'museum-web' }, body: form
});
```

版本图标走独立接口，创建版本仍保持 JSON 请求体，不需要改成 multipart。

版本详情渲染图标时按 `iconSource` 判断：`VERSION` 用 `iconUrl`，`SERIES` 回退系列图标（为空则占位），`NONE` 直接占位。

## 本次不包含

- 标签管理后台、标签合并、别名、层级。
- 标签热度趋势、推荐标签。
- 来源链接的抓取、快照、可信度评级。
- 版本图标裁剪、多尺寸、WebP 输出。
- 截图的排序调整、批量编辑、删除。
