# 缺失功能接口总览

本文是尚未实现的 5 组能力的接口设计总纲：约定、权限、错误码、数据模型、数据库迁移，以及实现时必须同步改动的安全配置。各模块的逐接口说明见下表。

| 模块 | 文档 | 覆盖原型 |
| --- | --- | --- |
| 收藏 | [收藏接口](favorites-api.md) | 00-主页、01-系列详情、02-内容详情、04-我的收藏 |
| 评论与回复 | [评论接口](comments-api.md) | 02-内容详情 |
| 编辑、删除、修改历史 | [编辑接口](editing-api.md) | 02-内容详情、05-个人主页 |
| 草稿与发布 | [草稿接口](drafts-api.md) | 03-发布内容、03-发布版本、05-个人主页、06-创建系列 |
| 个人资料与公开档案 | [资料接口](profile-api.md) | 05-个人主页 |
| 标签、来源、版本图标、截图补充字段 | [标签与来源接口](tags-source-icon-api.md) | 01、02、03、06 |
| 修改密码与找回密码 | [密码接口](password-api.md) | 无（账号能力） |
| 搜索与统计 | [搜索与统计接口](search-stats-api.md) | 00-主页、05-个人主页 |

已实现的能力见 [系列接口](series-api.md)、[版本接口](version-api.md)、[截图接口](screenshot-api.md)、[注册接口](register-api.md)、[登录接口](auth-api.md)。本文档只做设计，不改变现有行为；实施时按文档顺序落地。

## 通用约定

- 基地址：开发环境 `http://127.0.0.1:8080`。所有路径以 `/api` 开头，JSON 请求与响应默认 UTF-8。
- 认证：登录成功写入 `museum_access_token`（HttpOnly，30 分钟）。浏览器请求统一 `credentials: 'include'`。
- 写请求（POST/PUT/PATCH/DELETE）必须同时满足：
  - `Origin` 属于白名单（默认 `http://127.0.0.1:18191`、`http://localhost:18191`）；
  - 自定义头 `X-App-Request: museum-web`。
  缺少任一项返回 403 `REQUEST_FORBIDDEN`，与现有创建接口一致。
- 读请求（GET）不需要上述头，也不因失效 Cookie 被阻止。
- ID 均为 UUID 字符串；时间为 ISO-8601 UTC（`2026-10-30T08:00:00Z`）。
- 分页响应统一 `{items, page, size, totalElements, totalPages}`。`page` 从 0 开始，`size` 为 1～100，省略时 `size=20`。参数非法返回 400 `VALIDATION_ERROR`。
- 错误响应统一 `{code, message, requestId, fieldErrors}`。`fieldErrors` 为字段名到说明的对象，无字段错误时为 `{}`。
- 幂等：收藏、取消收藏、删除均为幂等操作，重复调用仍返回相同状态码。
- 并发：所有 PATCH 可携带 `expectedUpdatedAt`（上次读到的 `updatedAt`），不匹配返回 409 `CONCURRENT_MODIFICATION`，不写入任何改动。
- 未知 JSON 字段、类型错误、UUID 格式错误一律 400，不静默忽略。

## 权限矩阵

| 操作 | 匿名 | 登录用户 | 创建者 | 说明 |
| --- | --- | --- | --- | --- |
| 浏览已发布系列/版本/截图/评论/标签/档案 | 允许 | 允许 | 允许 | 默认公开 |
| 创建系列、创建版本 | 拒绝 | 允许 | — | 草稿或直接发布 |
| 编辑已发布系列/版本 | 拒绝 | 允许 | 允许 | 维基式协作，写修改历史 |
| 删除系列/版本 | 拒绝 | 拒绝 | 允许 | 非创建者 403 `NOT_RESOURCE_OWNER` |
| 查看/编辑/发布/删除自己的草稿 | 拒绝 | 允许（仅本人） | 允许 | 他人访问 404，不泄露存在性 |
| 收藏/取消收藏 | 拒绝 | 允许 | 允许 | 只能收藏已发布对象 |
| 发表评论/回复 | 拒绝 | 允许 | 允许 | 回复不能再被回复 |
| 删除评论 | 拒绝 | 仅作者 | 仅作者 | 顶层评论删除时连带回复 |
| 修改个人资料/头像/密码 | 拒绝 | 允许（仅本人） | — | 公开档案不暴露邮箱 |
| 上传版本图标、修改截图说明 | 拒绝 | 允许 | 允许 | 版本图标不改变系列图标 |
| 搜索、统计、标签列表 | 允许 | 允许 | 允许 | 结果只含已发布对象 |
| 邮箱验证、找回密码 | 允许 | 允许 | — | 不因账号是否存在改变响应 |

## 错误码

沿用现有格式。除既有 `VALIDATION_ERROR`、`AUTH_REQUIRED`、`TOKEN_INVALID`、`TOKEN_EXPIRED`、`AUTH_INVALID`、`INVALID_CREDENTIALS`、`REQUEST_FORBIDDEN`、`UPLOAD_TOO_LARGE`、`UNSUPPORTED_MEDIA_TYPE`、`INTERNAL_ERROR`、`SERIES_NOT_FOUND`、`VERSION_NOT_FOUND`、`SCREENSHOT_NOT_FOUND`、`ICON_NOT_FOUND`、`SERIES_ALREADY_EXISTS`、`VERSION_ALREADY_EXISTS`、`USERNAME_ALREADY_EXISTS`、`LOGIN_RATE_LIMITED`、`REGISTER_RATE_LIMITED` 外，新增：

| code | 状态 | 含义 |
| --- | --- | --- |
| `COMMENT_NOT_FOUND` | 404 | 评论不存在或已删除 |
| `COMMENT_PARENT_INVALID` | 400 | 父评论不存在、跨版本或本身是回复 |
| `NOT_RESOURCE_OWNER` | 403 | 只有创建者可以执行（删除、发布草稿） |
| `SERIES_NOT_EMPTY` | 409 | 系列下仍有版本，禁止删除 |
| `ALREADY_PUBLISHED` | 409 | 对象已是发布状态，不能重复发布 |
| `CONCURRENT_MODIFICATION` | 409 | `expectedUpdatedAt` 与当前不一致 |
| `RESET_TOKEN_INVALID` | 400 | 重置令牌无效、过期或已使用 |
| `RESET_RATE_LIMITED` | 429 | 找回密码请求过于频繁 |
| `AVATAR_NOT_FOUND` | 404 | 用户未设置头像 |
| `TAG_LIMIT_EXCEEDED` | 400 | 单个对象标签超过 10 个 |
| `DRAFT_INCOMPLETE` | 400 | 发布时必填字段仍缺失 |
| `SEARCH_CRITERIA_REQUIRED` | 400 | 搜索既没有关键词也没有筛选条件 |
| `TOKEN_REVOKED` | 401 | 改密后会话版本号已递增，旧 JWT 立即失效 |
| `USER_NOT_FOUND` | 404 | 公开档案的用户不存在或已禁用 |
| `REVISION_NOT_FOUND` | 404 | 修订记录不存在 |
| `PASSWORD_CHANGE_RATE_LIMITED` | 429 | 修改密码失败次数过多 |

## 数据模型

新增 7 张表，扩展 4 张既有表。字段名与 Java 实体使用驼峰、数据库使用下划线。

```
app_users (既有, V10/V13 扩展)
  display_name, bio, avatar_storage_key, email_verified_at, token_version

software_series (既有, V9/V12 扩展)
  status, published_at, source_url

software_versions (既有, V9/V12 扩展)
  status, published_at, number_status, date_status, release_date_text,
  platform_text, body, source_url, source_note, icon_storage_key

version_screenshots (既有, V12 扩展)
  source_text, time_text

favorites (V6)
  id, user_id, target_type, target_id, created_at
  UNIQUE(user_id, target_type, target_id)
  INDEX(target_type, target_id)

version_comments (V7)
  id, version_id, parent_id, author_id, content, created_at, updated_at
  INDEX(version_id, parent_id, created_at)

content_revisions (V8)
  id, target_type, target_id, revision_no, editor_id, changes, note, created_at
  UNIQUE(target_type, target_id, revision_no)

tags (V11)
  id, name, normalized_name, created_at
  UNIQUE(normalized_name)

series_tags (V11)
  series_id, tag_id  PRIMARY KEY(series_id, tag_id)

version_tags (V11)
  version_id, tag_id  PRIMARY KEY(version_id, tag_id)

password_reset_tokens (V13)
  id, user_id, token_hash, expires_at, used_at, created_at
```

`target_type` 取值 `SERIES`、`VERSION`；`status` 取值 `DRAFT`、`PUBLISHED`；`number_status`、`date_status` 取值 `EXACT`、`RANGE`、`UNKNOWN`。`changes` 为 JSON 文本，记录 `[{field, oldValue, newValue}]`，仅供展示，不参与查询。

## 数据库迁移

| 版本 | 内容 |
| --- | --- |
| V6 | `favorites` 表及唯一键、索引 |
| V7 | `version_comments` 表及索引；`content` 1～1000 字符由业务层校验 |
| V8 | `content_revisions` 表及唯一键 |
| V9 | `software_series`、`software_versions` 加 `status`（默认 `PUBLISHED`）、`published_at`；系列唯一键改为 `(normalized_name, status)`，版本唯一键改为 `(series_id, platform, normalized_number, status)` |
| V10 | `app_users` 加 `display_name`、`bio`、`avatar_storage_key` |
| V11 | `tags`、`series_tags`、`version_tags` |
| V12 | 版本三态字段、正文、来源、图标键；截图 `source_text`、`time_text`；系列 `source_url` |
| V13 | `app_users` 加 `email_verified_at`、`token_version`；`password_reset_tokens` |

迁移只新增，不修改 V1～V5，也不需要删库。V9 的默认值保证历史数据自动视为已发布；`published_at` 由迁移填充为 `created_at`。

## 实施影响

以下改动与接口本身同等重要，缺少任一项都会导致新接口返回 401/403 或 CORS 预检失败。

1. `config/SecurityConfig.java`
   - CORS `allowedMethods` 追加 `PUT`、`PATCH`、`DELETE`；
   - `allowedHeaders` 保持 `Content-Type`、`X-App-Request`；
   - 逐条放行新增路径，并把 `anyRequest().denyAll()` 保持在最后。GET 路径匿名可读；写路径使用 `authenticated()`。
   - CSRF 豁免：现有实现只豁免「auth 的 POST + 业务创建 POST」。新增 PUT/PATCH/DELETE 需按同样规则豁免，否则写请求会被 403。
2. `auth/BusinessRequestPaths.java`
   - 现有只识别 `/api/series`、`/api/series/{id}/versions`、`/api/versions/{id}/screenshots` 三个创建路径。新写路径同样要求 Origin 与 `X-App-Request`，建议改为「除 auth 路径外的所有非 GET 请求」统一校验，避免逐条维护遗漏。
3. `auth/JwtAuthenticationFilter.java`
   - 目前只对创建路径检查登录。收藏、评论、编辑等匿名可读、登录可写的混合路径，应改为「按 SecurityConfig 的放行规则判断」，而不是按路径字符串。
4. 上传目录
   - 新增 `data/uploads/version-icons/`、`data/uploads/avatars/`，通过 `museum.storage.*` 配置，与现有图标、截图目录一起备份。
5. 定时任务
   - 清理过期 `password_reset_tokens` 与孤儿上传文件，建议每日一次，先只做删除过期令牌。

## 原型映射

`docs/原型草稿/` 共 8 张原型图，逐页对应到接口，确认没有遗漏的功能点：

| 原型图 | 页面功能点 | 对应接口 |
| --- | --- | --- |
| 00-主页 | 全局搜索、卡片收藏按钮、分类标签、内容数、最近更新、统计 | `GET /api/search`、`GET /api/series`、`PUT/DELETE /api/series/{id}/favorite`、`GET /api/stats/overview` |
| 01-系列详情-版本链 | 收藏、添加版本、查找版本、平台筛选、分类标签、版本节点数、按平台版本链 | `GET /api/series/{id}`、`GET /api/series/{id}/versions`、`POST /api/series/{id}/versions`、`PUT /api/series/{id}/favorite`、`GET /api/series/{id}/stats` |
| 02-内容详情 | 编辑本版本、收藏、贡献者、查看修改历史、三态版本号/时间/平台、版本链入口、截图及说明来源、正文、讨论与回复、加载更多 | `PATCH /api/versions/{id}`、`PUT /api/versions/{id}/favorite`、`GET /api/versions/{id}/contributors`、`GET /api/versions/{id}/revisions`、`GET /api/versions/{id}/screenshots`、`PATCH /api/screenshots/{id}`、`GET|POST /api/versions/{id}/comments`、`GET /api/comments/{id}/replies` |
| 03-发布内容 | 所属系列、内容分类、标题、版本号、平台、发布日期、说明、截图/附件、资料来源链接、保存草稿/预览/发布 | `POST /api/series/{id}/versions`（含 `status`、三态字段、`sourceUrl`）、`GET /api/versions/{id}`、`POST /api/versions/{id}/publish` |
| 03-发布版本 | 五项显式选择（版本号/时间/平台/图标/截图）、上传版本图标、截图说明与时间范围与来源、正文 Markdown、草稿/预览/发布 | `POST /api/series/{id}/versions`、`POST /api/versions/{id}/icon`、`PATCH /api/versions/{id}`、`POST /api/versions/{id}/publish` |
| 04-我的收藏 | 系列/内容两个 tab、收藏数、搜索收藏、卡片字段 | `GET /api/me/favorites?target=SERIES|VERSION&q=` |
| 05-个人主页 | 头像、用户名、简介、编辑资料、统计数字、我的发布/我创建的系列/草稿箱、编辑/删除/继续编辑 | `PATCH /api/me/profile`、`POST /api/me/avatar`、`GET /api/users/{id}`、`GET /api/me/contributions`、`GET /api/me/drafts`、`PATCH/DELETE /api/series|versions/{id}` |
| 06-创建系列 | 名称、分类、平台、上传图标、简介、标签、官网/资料来源、保存草稿/预览/创建 | `POST /api/series`（含 `status`、`tags`、`sourceUrl`）、`GET /api/tags` |

原型中「内容」统一对应现有「版本」实体（决策 D13），不新增文章表。

## 端到端流程

1. 登录 → 创建系列（可保存草稿）→ 上传系列图标 → 发布。
2. 进入系列 → 添加版本（三态版本号/时间/平台、可选版本图标、截图、来源、标签）→ 保存草稿或直接发布。
3. 浏览者收藏系列/版本、发表评论与回复；创建者或任意登录用户编辑资料，产生修订记录。
4. 个人主页汇总发布、创建、收藏、草稿与贡献；公开档案只展示公开信息。
5. 首页搜索按关键词与筛选条件查询系列/版本；统计接口提供首页与系列页数字。

## 本次不包含

- 通知、站内信、@ 提及。
- 评论点赞、举报、审核队列。
- 版本修订的逐行 diff 渲染与回滚接口（只存快照，回滚后续再设计）。
- 系列/版本排序权重、置顶、推荐位。
- 全文检索、分词、相关度排序。
- 多语言、时区偏好、软删除回收站。
