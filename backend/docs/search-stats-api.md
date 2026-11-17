# 搜索与统计接口

原型首页有全局搜索框（顶部「搜索」+ 按钮），我的收藏页有「搜索收藏」，个人主页有统计行「发布内容 12　创建系列 3　收藏系列 8」。目前这些数字与筛选都由前端拉全量数据后自己算，数据一多就不可行。

本文设计服务端搜索与统计：搜索只做数据库 `LIKE` 子串匹配（不引入 Elasticsearch），统计用实时 `COUNT`，只统计公开对象，排除草稿。

相关文档：[总览与约定](api-overview.md)、[系列接口](series-api.md)、[版本接口](version-api.md)、[标签与来源接口](tags-source-icon-api.md)。

## 数据模型

搜索与统计不新增表，只读取既有表与本次新增字段（`tags`、`source_url`、`source_note`、三态版本字段、`status`、`published_at`、`favorites`、`version_comments`、`content_revisions`）。查询统一带 `status='PUBLISHED'` 条件。

可搜索字段：

| 对象 | 可搜索字段 |
| --- | --- |
| 系列 | `name`、`description`、标签名、`sourceUrl` 的主机名（可选） |
| 版本 | `versionNumber`、`numberText`、`body`、`description`、`releaseDateText`、`platformText`、标签名 |

建议索引（H2 不强制，PostgreSQL 部署时使用）：

- `software_series(normalized_name)`、`software_versions(series_id, platform, status)`；
- 标签加入检索时可先不建索引，数据量小。

搜索统一小写比较：查询词与字段都按 `Locale.ROOT` 转小写后做 `LIKE '%q%'`。`%`、`_` 属于用户输入时按字面处理（转义后再拼 SQL），不允许通配符注入。

## 接口

### 搜索

`GET /api/search?q=QQ&type=ALL&category=INSTANT_MESSAGING&platform=WINDOWS&tag=聊天&sort=UPDATED&page=0&size=20`

公开接口，无需登录。

参数：

- `q`：可选，去首尾空白后 1～100 字符。与筛选条件**至少提供一个**，都为空返回 400 `SEARCH_CRITERIA_REQUIRED`。
- `type`：`ALL`（默认）、`SERIES`、`VERSION`。
- `category`：系列分类代码，只影响系列结果与版本所属系列。
- `platform`：平台代码；系列按 `platforms` 包含匹配，版本按 `platform` 精确匹配。
- `tag`：标签名（大小写不敏感），系列与版本都按标签匹配。
- `sort`：`UPDATED`（默认，最近更新倒序）、`CREATED`（创建时间倒序）、`NAME`（名称正序）、`RELEVANCE`（完全匹配 → 前缀匹配 → 其余，同档按 `UPDATED`）。
- `page`、`size`：通用分页。

响应：

```json
{
  "query": "QQ",
  "items": [
    {
      "type": "SERIES",
      "series": {
        "id": "系列 UUID",
        "name": "QQ",
        "description": "一款国民级聊天软件",
        "category": "INSTANT_MESSAGING",
        "platforms": ["WINDOWS", "ANDROID"],
        "iconUrl": "/api/series/系列UUID/icon",
        "tags": ["聊天", "社交"],
        "versionCount": 24,
        "favoriteCount": 8,
        "updatedAt": "2026-10-27T08:00:00Z"
      }
    },
    {
      "type": "VERSION",
      "version": {
        "id": "版本 UUID",
        "versionNumber": "9.9",
        "platform": "WINDOWS",
        "updatedAt": "2026-10-27T08:00:00Z"
      },
      "series": { "id": "系列 UUID", "name": "QQ", "iconUrl": "/api/series/系列UUID/icon" }
    }
  ],
  "counts": { "series": 1, "versions": 1 },
  "page": 0,
  "size": 20,
  "totalElements": 2,
  "totalPages": 1
}
```

- `counts` 为本次查询条件下的命中总数（不受分页影响），用于 tab 上的数字。
- 只返回 `PUBLISHED` 对象；草稿、已删除对象不出现。
- 同一关键词命中系列的名称与版本的正文时，两条都返回，由 `type` 区分。
- `totalElements` 是系列 + 版本的合计；`type` 为单一类型时只统计该类型。

```javascript
const params = new URLSearchParams({ q, type: 'ALL', page: '0', size: '20' });
const response = await fetch(`/api/search?${params}`, { credentials: 'include' });
```

搜索是 GET，不要求 `X-App-Request`；带失效 Cookie 也照常返回公开结果。

### 站点统计

`GET /api/stats/overview`

公开接口，用于首页或页脚的数字展示：

```json
{
  "seriesCount": 36,
  "versionCount": 412,
  "screenshotCount": 1873,
  "contributorCount": 58,
  "commentCount": 240,
  "favoriteCount": 129,
  "tagCount": 74,
  "lastUpdatedAt": "2026-10-30T08:00:00Z"
}
```

口径：全部排除草稿；`contributorCount` 为修订记录中去重的编辑者数（含创建者）；`lastUpdatedAt` 取全站最大的 `updatedAt`。

### 平台分布

`GET /api/stats/platforms`

公开接口：

```json
{
  "items": [
    { "platform": "WINDOWS", "seriesCount": 30, "versionCount": 240 },
    { "platform": "ANDROID", "seriesCount": 12, "versionCount": 96 }
  ]
}
```

按 `versionCount` 倒序；平台代码沿用既有六种；没有数据的平台不出现。

### 时间线

`GET /api/stats/timeline?from=2000&to=2010`

公开接口，按版本发布时间统计分布：

- `from`、`to`：可选年份，`0001`～`9999`；省略时取数据中的最小/最大年份。
- 只统计 `dateStatus=EXACT` 且 `releaseDate` 非空的版本；`RANGE` 与 `UNKNOWN` 计入 `unknownCount`。
- 年份区间跨度上限 100 年，超出 400 `VALIDATION_ERROR`。

```json
{
  "items": [
    { "year": 2000, "versionCount": 12 },
    { "year": 2001, "versionCount": 30 }
  ],
  "unknownCount": 41
}
```

### 系列统计

`GET /api/series/{seriesId}/stats`

公开接口，用于系列详情页头部「6 个版本节点｜多人共同维护」这类文案：

```json
{
  "versionCount": 6,
  "platformCount": 3,
  "screenshotCount": 18,
  "contributorCount": 3,
  "commentCount": 2,
  "favoriteCount": 8,
  "firstReleaseYear": 2000,
  "lastUpdatedAt": "2026-10-30T08:00:00Z"
}
```

- 只统计该系列下 `PUBLISHED` 的版本；草稿版本不计。
- `contributorCount` 为该系列及其版本修订记录中的去重编辑者数。
- `firstReleaseYear`：最早 `EXACT` 年份；没有则为 `null`。

### 系列列表扩展

`GET /api/series` 增加筛选与排序参数，作为首页与搜索的轻量替代：

- `q`：名称/简介子串，≤100 字符；
- `category`：分类代码；
- `platform`：平台代码；
- `tag`：标签名；
- `sort`：`UPDATED`（默认）、`CREATED`、`NAME`、`VERSION_COUNT`。

响应在既有字段上追加：

```json
{
  "items": [
    {
      "id": "系列 UUID",
      "name": "QQ",
      "versionCount": 24,
      "favoriteCount": 8,
      "favoritedByMe": false,
      "tags": ["聊天", "社交"],
      "sourceUrl": "https://im.qq.com/"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1
}
```

`versionCount` 只统计已发布版本；`favoritedByMe` 在匿名请求中恒为 `false`。

## 权限与可见性

- 搜索、统计全部公开，不要求登录；`favoritedByMe` 需要 Cookie 才有意义。
- 结果与计数只包含 `PUBLISHED` 对象与其公开关联数据；草稿贡献者、草稿评论不进入任何统计。
- 不提供按用户维度的全站统计（个人统计在 [资料接口](profile-api.md)）。

## 错误

| 状态 | code | 场景 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 关键词或筛选值超长/非法、年份越界、分页参数错误 |
| 400 | `SEARCH_CRITERIA_REQUIRED` | `q` 与全部筛选都为空 |
| 404 | `SERIES_NOT_FOUND` | 系列统计的系列不存在或为草稿 |
| 500 | `INTERNAL_ERROR` | 聚合查询异常 |

## 实施影响

- 新增路径：`GET /api/search`、`GET /api/stats/overview|platforms|timeline`、`GET /api/series/{id}/stats`。全部匿名放行，加入 `SecurityConfig` 白名单即可。
- `GET /api/series` 的参数扩展属于向后兼容改动，默认行为保持不变（无参数时仍按创建时间倒序）。
- 统计查询集中放在一个 `StatsService`，使用 `COUNT`/`GROUP BY` 聚合，避免逐对象查询；系列列表的 `versionCount`/`favoriteCount` 用一次 `GROUP BY` 批量取，不要 N+1。
- 搜索结果分页使用两条查询（count + 分页），`type=ALL` 时先分别取两类再合并排序，注意每类最多取 `page*size+size` 条。
- `%`、`_` 需要转义：`q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")`，SQL 使用 `LIKE ? ESCAPE '\'`。

## 前端联调示例

```javascript
// 顶部全局搜索
async function search(q, type = 'ALL') {
  const params = new URLSearchParams({ q, type, page: '0', size: '20' });
  return fetch(`/api/search?${params}`, { credentials: 'include' }).then(r => r.json());
}

// 首页统计与平台分布
const [overview, platforms] = await Promise.all([
  fetch('/api/stats/overview').then(r => r.json()),
  fetch('/api/stats/platforms').then(r => r.json())
]);

// 系列列表按标签筛选
const list = await fetch(`/api/series?tag=${encodeURIComponent('聊天')}&sort=VERSION_COUNT`)
  .then(r => r.json());
```

搜索结果里的 `counts` 可用于 tab 徽标；分页请求时丢弃旧响应（快速输入时避免竞态覆盖）。

## 本次不包含

- 全文检索、分词、拼写纠错、同义词、相关度打分模型。
- 搜索历史、热门搜索词、搜索建议下拉。
- 结果高亮、按标签聚合的 facet 面板。
- 统计缓存、定时快照、图表数据导出。
- 按评论/收藏时间维度的趋势统计。
