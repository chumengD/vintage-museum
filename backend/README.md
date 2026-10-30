# 中国互联网数字记忆博物馆后端

技术栈：Spring Boot 4.1.2、Java 21、Maven、Spring Security、JPA、H2 文件数据库。
已实现用户表和注册接口，密码使用 Argon2id 保存，数据库由 Flyway 初始化。
已实现 username + password 登录、JWT Cookie 认证、查询当前用户及退出；email 仅为账号资料，不用于登录。
已新增软件系列创建、可选小图标上传、公开分页列表及详情查询；接口约定见 [系列接口说明](docs/series-api.md)，IDEA 示例见 `api/series.http`。
已实现系列下添加版本、按平台分页浏览及版本详情，详见 [版本接口说明](docs/version-api.md) 和 `api/version.http`。
已实现版本截图单张上传、多张关联、公开分页列表与图片读取，详见 [截图接口说明](docs/screenshot-api.md) 和 `api/screenshot.http`。

## 在 IntelliJ IDEA 中运行

1. 打开本目录的 `pom.xml`，作为 Maven 项目导入并等待依赖下载完成。
2. 在 Project Structure 中将 Project SDK 设为 JDK 21，Maven Runner 也使用 JDK 21。
3. 运行 `cn.digitalmemory.museum.MuseumApplication` 的 `main` 方法。
4. 工作目录设为项目根目录，控制台显示 `Started MuseumApplication` 即启动成功。
5. 默认监听 `127.0.0.1:8080`，点击 IDEA 的停止按钮结束运行。

默认使用 `dev` 配置，仅用于本机开发。没有网页首页；直接在地址栏访问受保护路径仍会返回 401。
注册使用 `POST /api/auth/register`，可在 IDEA 中打开 `api/register.http` 执行请求，完整约定见 [注册接口说明](docs/register-api.md)。
登录全流程可打开 `api/auth.http` 按顺序执行，详见 [登录接口说明](docs/auth-api.md)。
在 IDEA 中重新加载 Maven 依赖，停止旧进程后再运行启动类。Flyway 会自动创建用户表，无需删库或手动执行 SQL。
首次启动会在根目录的 `data/` 中创建 H2 数据库。该目录不应提交版本控制。
本地开发数据库使用专用演示密码；可用 `MUSEUM_DB_PASSWORD` 覆盖，已有数据库必须继续使用其创建时的密码。
H2 控制台关闭。公开部署需单独准备部署配置，此开发配置不用于公开服务。
开发环境首次启动会自动在 `data/jwt-secret.key` 保存随机 JWT 密钥；重启沿用，不要删除或提交。
不需要手动配置开发密钥。部署时应启用独立配置，并通过 `MUSEUM_JWT_SECRET` 提供 Base64 编码的安全随机密钥。

## 命令行

在项目根目录执行（系统已安装 Maven 3.6.3+ 和 JDK 21）：

```text
mvn clean verify
mvn spring-boot:run
```

或构建后运行：

```text
java -jar target/museum-backend-0.0.1-SNAPSHOT.jar
```

自动化测试使用独立的内存数据库，不读取或修改开发数据库。

本次建立项目时，为避免修改全局 Maven 缓存，依赖下载到项目的 `.maven/repository/`。
如需复用这份缓存，可执行：

```text
mvn -Dmaven.repo.local=.maven/repository verify
mvn -Dmaven.repo.local=.maven/repository spring-boot:run
```

项目骨架已通过构建、数据库及启动检查，用户已确认能够在 IDEA 启动。
全部 64 项自动测试通过，覆盖注册、邮箱及数据库升级、登录、JWT 校验、Cookie 退出、基础请求防护、系列与图标、版本及截图上传、图片限制、失败清理和公开浏览，使用隔离数据库和测试上传目录。
另已使用打包程序和隔离的开发数据库、密钥验证：注册 201、登录 200、服务重启后原 JWT 查询用户 200、退出 204。测试进程已停止，不影响现有开发账号。
另已用隔离文件数据库启动两次，验证首次注册返回 201、重启后同名注册返回 409，确认迁移可重复执行且账号持久保存。

## 账号规则

- 用户名：2～32 位，英文字母、数字、下划线；去除首尾空格并转小写后校验，数据库唯一。
- 密码：4～64 个 Unicode 码点；不去空格、不改大小写、不截断；注册和登录使用同一编码器。
- 邮箱：注册时可选填写，校验基本格式及最长 254 字符；不验证归属、不要求唯一，登录仍只使用 username。已有用户通过数据库迁移增加可空邮箱字段，无需删库。
- 注册成功后手动登录，不自动签发 JWT。
- 登录采用 30 分钟 JWT + HttpOnly Cookie，不做 refresh token，过期重新登录。退出只清除当前浏览器 Cookie，已复制的 JWT 到期前仍可能使用；重复登录及单纯修改密码不会自动撤销旧 JWT。

注册成功不自动登录。通过注册接口创建测试账号；项目不包含默认业务用户。
登录后 GET /api/auth/me 返回当前用户；退出后浏览器不再携带 Cookie，该请求返回 401。
