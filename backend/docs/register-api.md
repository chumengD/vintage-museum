# 注册接口

已实现注册，登录、查询当前用户和退出的约定见 [登录接口说明](auth-api.md)。

## 请求

`POST /api/auth/register`，不需要登录。

必要请求头：

```http
Content-Type: application/json
Origin: http://localhost:5173
X-App-Request: museum-web
```

```json
{
  "username": "Museum_01",
  "password": "1234",
  "email": "museum@example.com"
}
```

- 用户名：去首尾空白后校验 2～32 位 ASCII 英文字母、数字、下划线，再以小写保存；登录实现时复用同一规则。
- 密码：4～64 个 Unicode 码点，中文、空格、表情均可；不会去空格、转换大小写或截断。
- email：可选账号资料，填写时校验基本邮箱格式，最多 254 个字符；去掉首尾空白，保留大小写。省略、null、空字符串和纯空白均按未填写保存为 null。
- 现阶段不发送验证邮件、不确认邮箱归属、不要求邮箱唯一，不使用邮箱登录或找回密码。
- 确认密码在前端检查，不传给后端。缺失 username/password、非法 JSON、额外字段（包括 id、status）返回 400。
- 接受 username、password 和可选的 email 字符串字段。示例密码仅为本地测试。
- 前端按实际来源发送请求。默认白名单包含 localhost 和 127.0.0.1 的 5173、3000、8080 端口。
- 在 IDEA Run Configuration 的环境变量中设置 `MUSEUM_ALLOWED_ORIGINS` 可以覆盖白名单，多个来源用逗号分隔，不能使用通配符。
- 浏览器会自动发送 Origin；Postman、IDEA HTTP Client 等工具必须显式填写。
- 跨域预检允许 POST、Content-Type、X-App-Request。凭据配置兼容未来 Cookie 登录，但当前注册不依赖凭据。

## 成功

`201 Created`，示例：

```json
{
  "user": {
    "id": "6d680949-6726-4885-82cd-4bbf18abfb5e",
    "username": "museum_01",
    "email": "museum@example.com"
  }
}
```

响应包含 `Cache-Control: no-store`，不包含密码、哈希或 JWT，不设置或删除登录 Cookie。
未填写 email 时响应中的 email 为 null。返回邮箱不代表邮箱已验证；登录仍只使用 username。
前端显示注册成功，跳转登录页，由用户通过 POST /api/auth/login 登录；注册不会自动签发 JWT。

## 错误

```json
{
  "code": "VALIDATION_ERROR",
  "message": "请检查输入字段",
  "requestId": "随机请求标识",
  "fieldErrors": {
    "password": "密码须为 4～64 个字符"
  }
}
```

错误响应包含 `X-Request-Id`。fieldErrors 在非字段错误时为空对象，不回显提交的密码。

| 状态码 | code | 含义 |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | 字段不合法、JSON 不合法或包含额外字段 |
| 403 | REQUEST_FORBIDDEN | Origin 不在白名单、缺失或自定义头不正确 |
| 409 | USERNAME_ALREADY_EXISTS | 用户名已被注册，包括大小写不同的同名账号 |
| 415 | UNSUPPORTED_MEDIA_TYPE | 请求不是 application/json |
| 429 | REGISTER_RATE_LIMITED | 超过注册限速，按 Retry-After 秒数等待 |
| 500 | INTERNAL_ERROR | 服务异常，使用 requestId 排查 |

如果来源或请求头不合法，会优先返回 403；来源合法但已经达到限速时，优先返回 429。
来源被拒绝时浏览器可能只显示跨域错误，这是不向该来源开放响应的预期行为。

## 数据与安全

- app_users 保存 UUID、唯一用户名、Argon2id 密码哈希、可空且不唯一的 email、状态、创建/更新时间。
- 已有数据库通过 V2 迁移增加 email 列；旧用户邮箱为空，用户 ID 和密码保持原值。不修改已执行的 V1 脚本，不需要删库。
- Flyway 首次启动自动建表，之后校验版本；JPA 只验证表结构，不自动改表。不需要手工执行 SQL，也不要删除已有数据库。
- 并发创建同名账号时，数据库唯一约束确保只有一条记录；冲突转换为 409。
- Argon2id 参数：16 字节随机盐、32 字节哈希、19 MiB 内存、2 次迭代、并行度 1。注册和后续登录共享 PasswordEncoder。
- 默认同一直接连接 IP 每分钟最多 10 次注册 POST 请求，包括通过来源检查的失败请求。单实例内存计数，重启重置；容量上限 10000 个 IP，容量满时拒绝新 IP，不通过驱逐旧记录绕开限制。
- 不采信客户端的 X-Forwarded-For。反向代理部署前需要专门配置可信代理，否则多个访问者可能共享代理 IP 的额度。
- 来源检查、自定义头、严格 CORS 防护注册 POST；Spring Security 只对该接口豁免默认 CSRF token 检查，其余请求保留默认检查。
- 当前没有默认业务账号、验证码、找回密码、自动登录或 JWT 签发。公开部署仍需 HTTPS 和独立部署配置。

## 验证

IDEA 打开 `api/register.http`，运行各请求；也可以在 Postman 中配置相同请求。
首次请求返回 201，再次请求返回 409。用户名变成小写是预期行为。

自动测试包含长度边界、Unicode 密码、密码哈希和随机盐、重复和并发注册、非法 JSON/字段、来源/预检、429 限速等。
测试数据库与本地文件数据库隔离，不创建或清除开发用户。
