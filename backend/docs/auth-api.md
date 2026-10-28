# 登录、当前用户和退出

已实现三个接口。登录只接受 username + password，email 是未验证的账号资料。
注册规则仍为用户名 2～32 位、密码 4～64 个 Unicode 码点。

## 在 IDEA 中验证

重新加载 Maven 依赖，停止旧进程，再运行 MuseumApplication。
开发配置会自动在 `data/jwt-secret.key` 创建随机密钥，不需要手动填写；该文件已被 data/ 的忽略规则排除。
不要删除或提交密钥文件。重启沿用同一密钥，用户的未过期 JWT 可以继续使用。

打开 `api/auth.http`，按顺序执行：注册测试账号 → 登录 → 查询当前用户 → 退出 → 再查询。
预期状态依次为 201（同名已存在时 409）、200、200、204、401。
HTTP Client 默认保存 Cookie；需要保持同一个 baseUrl，并关闭请求中的 no-cookie-jar 选项（本示例没有该选项）。
如果同名账号已经存在，登录需使用该账号原来的密码；重复注册不会修改原密码或邮箱。

## POST /api/auth/login

请求头：

```http
Content-Type: application/json
Origin: http://localhost:5173
X-App-Request: museum-web
```

请求体：

```json
{
  "username": "museum_login_01",
  "password": "1234"
}
```

用户名去除首尾空白并转为小写，密码保持原样。严格接收这两个字符串字段，不能额外提交 email、id、role 等字段。
后端查询账号并用注册时相同的 Argon2id PasswordEncoder 验证密码。账号不存在时也执行模拟哈希校验。
账号不存在、密码错误或账号禁用统一返回 401 / INVALID_CREDENTIALS。

成功返回 200：

```json
{
  "user": {
    "id": "6d680949-6726-4885-82cd-4bbf18abfb5e",
    "username": "museum_login_01",
    "email": "museum@example.com"
  },
  "expiresAt": "2026-10-28T02:00:00Z"
}
```

expiresAt 是 UTC 时间示例，实际为签发时间加 30 分钟。email 可能为 null，也不表示已验证。
响应包含 Cache-Control: no-store，通过 Set-Cookie 写入 JWT；响应体不包含 JWT。

Cookie 名称为 museum_access_token：HttpOnly、SameSite=Lax、Path=/api、Max-Age=1800、不设置 Domain。
本机 dev 配置使用 HTTP，Secure=false；公共配置 Secure=true，部署时必须使用 HTTPS。
前端不将 JWT 保存到 localStorage，也不读取登录 Cookie。

已有 Cookie 无论是否过期或损坏，都不会拦截本次账号密码登录；成功覆盖 Cookie，失败不改 Cookie。
再次登录签发新的 jti，但不会撤销旧 JWT，也不会强制其他设备退出。

## GET /api/auth/me

无请求体。只从 Cookie 中提取 JWT，不接受 Authorization Bearer、查询参数或请求体中的 token。
签名及 claims 校验通过后，按 sub 中的 UUID 查询用户，确认存在且处于 ACTIVE 状态。
返回 200，响应体包含 user（id、username、email）。资料来自当前数据库，不把 email 或 username 固定在 JWT 中。
响应包含 Cache-Control: no-store，不重新写入 Cookie，不延长 JWT 有效期。

浏览器地址栏访问此 GET 接口时，已登录且 Cookie 有效返回用户资料，未登录返回 401。
GET 接口不要求 X-App-Request；跨域访问仍需通过 CORS 白名单。

## POST /api/auth/logout

无请求体。必须包含白名单 Origin 和 X-App-Request: museum-web。
成功返回 204，无响应体，包含 Cache-Control: no-store。
使用相同名称、Path 和安全属性设置 Max-Age=0 的 Cookie 清除指令。
凭据缺失、过期或损坏也允许清理；不校验 JWT，不访问数据库，重复调用仍为 204。

第一版退出只清除当前浏览器的 Cookie，服务端不记录撤销名单。
手动复制的旧 JWT 在到期前仍可重放。修改密码也不会自动撤销已签发 JWT。
用户被禁用或删除后，因为每次认证都查询用户，之后的 /me 请求会失败。
没有 refresh token，也没有服务端保存登录状态的 HttpSession。

## JWT 和密钥

- 固定采用 HS256，拒绝 none 及其他签名算法；只信任本地配置密钥，不根据 JWT 提供的 URL 获取密钥。
- sub：用户 UUID；iss：digital-memory-museum；aud：museum-api；iat、exp：签发与过期时间；jti：独立 UUID。
- 必须包含并校验这些字段；校验签发者、接收方、UUID 格式、签名和时间；若携带 nbf，也校验其生效时间。
- 单体应用使用本机时间严格判定有效期，到达 exp 即失效。/me 不滑动续期。
- JWT 不放密码、密码哈希、用户名和 email。签名不等于内容加密。
- dev 首次生成至少 32 字节的安全随机密钥，Base64 保存到本地文件，后续启动读取。
- 测试环境使用隔离的测试密钥，不用于部署。
- 部署需显式启用独立配置（例如 prod）、提供数据库配置，并通过 MUSEUM_JWT_SECRET 传入至少 32 字节随机密钥的 Base64 值。公共配置不自动生成密钥，缺失、格式错误或长度不足会启动失败。
- 不要使用可记忆的口令充当密钥。主动更换密钥会令旧 JWT 全部无法通过签名校验。

## 请求防护与前端联调

注册、登录、退出 POST 统一校验 Origin 白名单和 X-App-Request: museum-web。
该自定义头不是密码；与严格的来源检查、CORS 配合，替代这三个接口的默认 CSRF token 检查。其余请求保留默认 CSRF 保护。
白名单沿用 MUSEUM_ALLOWED_ORIGINS（逗号分隔的明确来源）；默认本地 5173、3000、8080 端口。

跨域前端请求设置 credentials: include，浏览器自动处理 Set-Cookie；不能在前端读取 Set-Cookie。
推荐开发代理把 /api 转发到后端。前后端应使用一致的主机名：localhost 配 localhost，127.0.0.1 配 127.0.0.1；不要混用两者，否则 Cookie 和 SameSite 规则可能使凭据无法发送。
HTTP Client 示例中的 Origin 是模拟请求头，不代表它运行在浏览器站点中。

登录和注册各自按直接连接 IP 每分钟最多 10 次，通过来源检查的失败请求也计数，两个计数器独立。
登录额度用尽不会妨碍退出清理。计数在单实例内存中，重启重置；不采信任意 X-Forwarded-For。
公开部署在可信代理、HTTPS 和真实访问量确定后，再调整此策略。
不记录密码、完整 JWT、Cookie 或请求体；错误不回显密码及 token。

## 错误响应

沿用 code、message、requestId、fieldErrors 格式，包含 X-Request-Id 和 Cache-Control: no-store。

| 接口或场景 | 状态码 | code |
| --- | --- | --- |
| 登录输入格式错误 | 400 | VALIDATION_ERROR |
| 账号不存在、密码错误或禁用 | 401 | INVALID_CREDENTIALS |
| /me 没有 Cookie | 401 | AUTH_REQUIRED |
| /me JWT 过期 | 401 | TOKEN_EXPIRED |
| /me JWT 格式、签名、claims 或算法不合法 | 401 | TOKEN_INVALID |
| /me 对应用户被禁用或删除 | 401 | AUTH_INVALID |
| 来源或必要请求头不正确 | 403 | REQUEST_FORBIDDEN |
| 登录不是 JSON | 415 | UNSUPPORTED_MEDIA_TYPE |
| 登录超过限速 | 429 | LOGIN_RATE_LIMITED |
| 数据库或服务异常 | 500 | INTERNAL_ERROR |

429 包含 Retry-After。来源检查优先于限速和账号密码校验。

## 验证覆盖

自动测试包含正确/错误密码、账号不存在、Unicode 和空白密码、邮箱不能登录、无凭据、Bearer 不被接受、JWT 过期/篡改/算法/必要字段、用户禁用及删除、重复登录、浏览器 Cookie 退出与旧 JWT 重放、改密码不自动撤销、来源检查、CORS、限速、安全 Cookie 属性、开发密钥重启复用和密钥配置失败。
测试使用独立数据库，不修改已有开发账号。
