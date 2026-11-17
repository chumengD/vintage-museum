# 系列下的软件版本（最小 Demo）

版本必须属于一个已有系列；本文记录版本资料，截图上传见 [截图接口说明](screenshot-api.md)。编辑、删除、修改历史与贡献者见 [编辑接口](editing-api.md)，草稿与发布见 [草稿接口](drafts-api.md)，评论见 [评论接口](comments-api.md)，收藏见 [收藏接口](favorites-api.md)，标签、来源与版本图标见 [标签与来源接口](tags-source-icon-api.md)。

当前实现不包含资料来源、不确定时间文本或状态字段；完整字段设计见下节与上述文档。

## 添加版本

`POST /api/series/{seriesId}/versions`，需要登录 Cookie、白名单 Origin、`X-App-Request: museum-web`、`Content-Type: application/json`。跨域前端须设置 `credentials: include`。

```json
{
  "versionNumber": "1.2 Beta",
  "platform": "WINDOWS",
  "releaseDate": "2001-02-03",
  "description": "记录这一版本的界面和功能变化。"
}
```

- versionNumber：必填文本，去首尾空白后 1～100 个 UTF-16 字符，保留大小写和中间空白。不当作数字处理。
- platform：必填，一个版本对应一个平台，必须属于创建系列时选择的平台。代码沿用 WINDOWS、ANDROID、IOS、MACOS、LINUX、OTHER。
- releaseDate：可选，省略或 null 表示未知；填写时必须为 YYYY-MM-DD 格式的真实日期（年份 0001～9999）。不接受空字符串、年份范围或时间戳。这是软件的发布日期，与记录创建时间不同。
- description：可选纯文本，去首尾空白，最多 5000 个 UTF-16 字符，空白按 null 保存。前端按普通文本显示。
- 不接收额外字段及错误类型；createdBy 自动取自认证用户。
- 同一系列、同一平台下，版本号去首尾空白并按 Locale.ROOT 转小写后唯一；并发重复创建也只有一个成功。不同平台或不同系列可使用相同版本号。

### 设计文档新增字段（尚未实现）

| 字段 | 说明 |
| --- | --- |
| `numberStatus` | `EXACT`/`RANGE`/`UNKNOWN`，配合 `versionNumber` 或 `numberText` |
| `dateStatus` | `EXACT`/`RANGE`/`UNKNOWN`，配合 `releaseDate` 或 `releaseDateText` |
| `platformText` | 平台补充说明，如「Windows，具体版本暂缺」；`platform` 仍必填 |
| `body` | 正文 Markdown，≤20000 字符，服务端不渲染 |
| `sourceUrl` / `sourceNote` | 资料来源链接（≤500）与来源说明（≤200） |
| `tags` | ≤10 个标签，整体替换 |
| `iconChoice` | `INHERIT`/`UPLOAD`/`NONE`，响应中体现为 `iconUrl` + `iconSource` |
| `status` / `publishedAt` | `DRAFT`/`PUBLISHED`；草稿仅创建者可见 |
| `commentCount` / `favoriteCount` / `contributorCount` | 详情响应追加的只读计数 |


成功返回 201，Location 为 `/api/versions/{id}`，响应：

```json
{
  "version": {
    "id": "版本 UUID",
    "seriesId": "系列 UUID",
    "versionNumber": "1.2 Beta",
    "platform": "WINDOWS",
    "releaseDate": "2001-02-03",
    "description": "记录这一版本的界面和功能变化。",
    "createdBy": "用户 UUID",
    "createdAt": "2026-10-30T08:00:00Z",
    "updatedAt": "2026-10-30T08:00:00Z"
  }
}
```

成功创建也会更新所属系列的 updatedAt；创建失败不更新。

## 浏览版本

`GET /api/series/{seriesId}/versions?page=0&size=20&platform=WINDOWS`

公开分页查询，platform 可省略。page 从 0 开始，size 为 1～100。响应 `{items: [版本对象], page, size, totalElements, totalPages}`。空系列返回空列表；不存在的系列返回 404。按记录创建时间倒序、UUID 次级倒序展示，不代表历史版本链，也不按版本号字符串排序。

`GET /api/versions/{versionId}`

公开详情，响应 `{version: 版本对象, series: {id, name, iconUrl}}`。iconUrl 沿用所属系列图标，未设置时为 null，前端显示默认占位图。浏览不会因为失效 Cookie 被阻止。

设计文档新增（尚未实现）：详情响应追加 `iconUrl`/`iconSource`（`VERSION`→`SERIES`→`NONE` 回退）、`commentCount`、`favoriteCount`、`contributorCount`、`tags`、`sourceUrl`、`sourceNote`；列表增加 `q` 与 `status` 之外的筛选按需扩展。草稿版本对非创建者返回 404 `VERSION_NOT_FOUND`，不进入列表、搜索与统计。

## 错误与运行

沿用现有错误结构。400 / VALIDATION_ERROR：字段、日期、分页或 UUID 错误；401：创建未登录或凭据失效；403 / REQUEST_FORBIDDEN：来源或必要请求头错误；404 / SERIES_NOT_FOUND 或 VERSION_NOT_FOUND：对象不存在；409 / VERSION_ALREADY_EXISTS：版本重复；415 / UNSUPPORTED_MEDIA_TYPE：非 JSON 请求。

Flyway 新增 V4，不修改 V1～V3，也不需要删库。重启 IDEA 中的 MuseumApplication 后自动升级。先运行 auth.http 登录，再运行 series.http 创建系列，最后运行 version.http 创建和查询版本。
