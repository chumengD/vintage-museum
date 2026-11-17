# 修改密码与找回密码接口

现有账号体系只有「注册 + 登录 + 退出」，没有改密与找回。README 也明确写着「重复登录及单纯修改密码不会自动撤销旧 JWT」——这是需要补上的能力。

本文定义三件事：登录用户修改密码、邮箱归属验证、未登录用户通过邮件重置密码。设计原则：**任何找回流程的响应都不能泄露账号是否存在**，令牌一次有效、短时效，重置成功后旧会话立即失效。

相关文档：[总览与约定](api-overview.md)、[登录接口](auth-api.md)、[注册接口](register-api.md)、[资料接口](profile-api.md)。

## 数据模型

V13 迁移：

`app_users` 增加：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `email_verified_at` | TIMESTAMP NULL | 邮箱归属验证时间；未验证为 `null` |
| `token_version` | INT NOT NULL DEFAULT 0 | 会话版本号，递增后旧 JWT 全部失效 |

`password_reset_tokens`（同时用于邮箱验证）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID | 主键 |
| `user_id` | UUID | 所属用户 |
| `purpose` | VARCHAR(16) | `EMAIL_VERIFICATION` / `PASSWORD_RESET` |
| `token_hash` | CHAR(64) | 令牌的 SHA-256 十六进制摘要，不存明文 |
| `expires_at` | TIMESTAMP | 过期时间，UTC |
| `used_at` | TIMESTAMP NULL | 使用时间，非空即已消费 |
| `created_at` | TIMESTAMP | 创建时间 |

- 索引 `(token_hash)` 唯一，`(user_id, purpose)` 用于作废旧令牌。
- 令牌明文只出现在邮件链接里，数据库泄露也拿不到可用令牌。
- 过期时间：重置密码 30 分钟，邮箱验证 24 小时。
- 同一用户同一 `purpose` 只保留最新一条有效令牌：申请新令牌时把旧的标记为已使用。

## 接口

### 修改密码

`PUT /api/me/password`

需要登录 Cookie、白名单 `Origin`、`X-App-Request: museum-web`、`Content-Type: application/json`。

```json
{
  "currentPassword": "旧密码",
  "newPassword": "新密码"
}
```

- `currentPassword`：必填，用与登录相同的 Argon2id 校验；错误返回 400 `VALIDATION_ERROR`，`fieldErrors.currentPassword` 为「当前密码不正确」（不返回 401，避免前端误判为掉登录）。
- `newPassword`：必填，4～64 个 Unicode 码点，规则与注册一致；不允许与 `currentPassword` 相同，返回 400。
- 失败次数限速：同一用户 10 分钟内最多 5 次失败，超出返回 429 `PASSWORD_CHANGE_RATE_LIMITED`。

成功返回 `204`，并执行：

1. 更新密码哈希；
2. `token_version = token_version + 1`；
3. 作废该用户未使用的 `PASSWORD_RESET` 令牌；
4. 当前响应清除 `museum_access_token` Cookie（`Max-Age=0`），前端收到 204 后跳转登录页。

因为 `token_version` 递增，**其它设备上已签发的 JWT 在下一次请求时立即返回 401**（见错误码 `TOKEN_REVOKED`）。这是对现有「改密不撤销 JWT」缺陷的修正。

### 请求邮箱验证

`POST /api/auth/email-verification/request`

需要登录 Cookie（未验证邮箱的账号才能发起），无请求体。向账号当前邮箱发送验证链接。

- 账号没有邮箱：400 `VALIDATION_ERROR`，`fieldErrors.email` 为「请先补充邮箱」；本次不提供补充邮箱的接口（见「本次不包含」）。
- 10 分钟内重复申请：429 `RESET_RATE_LIMITED`。
- 邮件发送失败不回显具体原因，仍返回 `202`，避免暴露 SMTP 配置。

成功返回 `202 Accepted`，无响应体。

### 确认邮箱验证

`POST /api/auth/email-verification/confirm`

公开接口，`Content-Type: application/json`：

```json
{ "token": "邮件中的令牌" }
```

- 令牌有效且未过期：写入 `email_verified_at=now`，令牌标记已使用，返回 `200` `{ "emailVerified": true }`。
- 令牌无效、过期、已使用：400 `RESET_TOKEN_INVALID`（同一错误码，不区分原因）。

邮件里的链接应指向前端页面（例如 `/verify-email?token=...`），由页面调用本接口；后端不直接处理 GET 链接，避免邮件客户端预取导致令牌被消费。

### 申请找回密码

`POST /api/auth/password-reset/request`

公开接口：

```json
{ "account": "laozhou" }
```

- `account` 可以是 `username` 或注册邮箱，去首尾空白后 1～254 字符。
- **无论账号是否存在、是否验证邮箱，一律返回 `202 Accepted` 且无响应体**，邮件只在账号存在且 `email_verified_at` 非空时发送。
- 限速：同一 IP 10 分钟内最多 3 次，同一账号 10 分钟内最多 1 次；超限返回 429 `RESET_RATE_LIMITED`（此响应会暴露「该账号刚被申请过」，属可接受的权衡，前端只需提示稍后再试）。
- 账号未验证邮箱时静默跳过发送；此时用户收不到邮件，需要先登录完成邮箱验证。

### 确认重置密码

`POST /api/auth/password-reset/confirm`

公开接口：

```json
{ "token": "邮件中的令牌", "newPassword": "新密码" }
```

- 令牌有效：更新密码哈希、`token_version+1`、令牌标记已使用、作废同用户其余重置令牌，返回 `200` `{ "reset": true }`。
- 令牌无效/过期/已用：400 `RESET_TOKEN_INVALID`。
- 新密码不符合 4～64 码点：400 `VALIDATION_ERROR`。
- 成功后所有旧 JWT 失效，包括攻击者此前窃取的会话。

### 登录时的邮箱验证状态

`GET /api/auth/me` 响应增加：

```json
{
  "user": {
    "id": "用户 UUID",
    "username": "laozhou",
    "displayName": "老周",
    "email": "laozhou@example.com",
    "emailVerified": true,
    "avatarUrl": null
  }
}
```

`email` 仍只在本人接口返回；`emailVerified` 用于个人主页提示「验证邮箱后才能找回密码」。

## 权限与可见性

| 接口 | 匿名 | 登录 |
| --- | --- | --- |
| `PUT /api/me/password` | 拒绝 | 允许（仅本人） |
| `POST /api/auth/email-verification/request` | 拒绝 | 允许（仅本人） |
| `POST /api/auth/email-verification/confirm` | 允许 | 允许 |
| `POST /api/auth/password-reset/request` | 允许 | 允许 |
| `POST /api/auth/password-reset/confirm` | 允许 | 允许 |

- 找回密码接口的响应与耗时不应区分账号是否存在；账号不存在时也可做一次假的哈希计算，降低时序侧信道。
- 邮件正文只包含令牌与有效期，不包含用户名以外的个人信息。

## 错误

| 状态 | code | 场景 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 密码长度/格式、当前密码错误、新旧密码相同、缺少邮箱、`account` 非法 |
| 400 | `RESET_TOKEN_INVALID` | 令牌不存在、过期、已使用、用途不匹配 |
| 401 | `AUTH_REQUIRED` / `TOKEN_INVALID` / `TOKEN_EXPIRED` / `TOKEN_REVOKED` / `AUTH_INVALID` | 未登录、凭据失效、改密后旧会话被撤销 |
| 403 | `REQUEST_FORBIDDEN` | 写请求缺少 Origin 或 `X-App-Request` |
| 429 | `RESET_RATE_LIMITED` | 找回密码/邮箱验证申请过于频繁 |
| 429 | `PASSWORD_CHANGE_RATE_LIMITED` | 改密失败次数过多 |
| 500 | `INTERNAL_ERROR` | 邮件服务异常（对客户端仍表现为已受理的场景除外） |
| 503 | `MAIL_UNAVAILABLE` | 邮件服务未配置或不可用（仅管理端可见的日志，接口不返回给匿名用户） |

## 实施影响

- 新增路径：`PUT /api/me/password`、`POST /api/auth/email-verification/request|confirm`、`POST /api/auth/password-reset/request|confirm`。两个 `confirm` 与 `reset/request` 必须匿名放行；`PUT /api/me/password` 要求登录。
- `POST /api/auth/password-reset/request` 等属于 auth 路径，现有 `AuthRequestProtectionFilter` 已对 auth POST 校验 Origin 与 `X-App-Request`，需把这些路径加入 `ENDPOINTS` 集合，否则前端无法调用。
- JWT 校验需增加 `token_version` 比对：`JwtAuthenticationFilter` 查到用户后比较声明中的 `tv` 与数据库值，不一致返回 401 `TOKEN_REVOKED`。签发时把当前 `token_version` 写入自定义 claim。
- 新增依赖：Spring Boot Mail（`spring-boot-starter-mail`）+ SMTP 配置。无邮件服务时 `request` 接口仍返回 202，但记录警告日志。
- 发送邮件应在事务提交后异步执行，避免事务回滚后邮件已发出。
- 令牌清理任务：删除 `expires_at < now - 7 天` 的记录。

## 前端联调示例

```javascript
// 修改密码：成功后跳到登录页（Cookie 已被清除）
const change = await fetch('/api/me/password', {
  method: 'PUT', credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'X-App-Request': 'museum-web' },
  body: JSON.stringify({ currentPassword: oldPwd, newPassword: newPwd })
});
if (change.status === 204) location.href = '/login';

// 忘记密码：先申请，再落地页提交 token
await fetch('/api/auth/password-reset/request', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-App-Request': 'museum-web' },
  body: JSON.stringify({ account })
}); // 一律 202，不提示账号是否存在

await fetch('/api/auth/password-reset/confirm', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-App-Request': 'museum-web' },
  body: JSON.stringify({ token: new URL(location.href).searchParams.get('token'), newPassword })
});
```

两个 `confirm` 与 `request` 都是匿名接口，但仍需带 `X-App-Request`，因为 auth 路径加入了统一防护。

## 本次不包含

- 修改用户名、补充/换绑邮箱（需要先有邮箱验证闭环，建议后续单独设计）。
- 短信验证码、二次验证（2FA）。
- 管理员重置他人密码。
- 登录设备列表与「退出所有设备」按钮（`token_version` 已具备基础，界面后续再加）。
- 邮件模板管理、多语言邮件。
