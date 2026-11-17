# 旧时博物馆前端

React + Vite + Tailwind CSS 4；Radix UI 交互组件，React DayPicker 日历，react-markdown 正文。

## 启动真实前后端

1. 按 `../backend/README.md` 在 IDEA 或 Maven 中启动后端，默认地址 `http://127.0.0.1:8080`。
2. 在本目录执行：

```powershell
npm install
npm run dev
```

打开 `http://127.0.0.1:5173`。开发模式默认使用真实后端，没有默认账户，请先注册。使用 **用户名和密码** 登录，邮箱为可选资料。用户名为 2–32 位字母、数字或下划线；密码为 4–64 个 Unicode 字符。注册成功后手动登录，Cookie 有效期 30 分钟。

`/api` 通过 Vite 代理转发。所有写入请求发送后端要求的 `X-App-Request: museum-web`；不读取或保存 JWT。端口被占用时直接报错，避免自动切换后不符合后端 Origin 白名单。

自定义后端地址可创建 `.env.development.local`：

```dotenv
API_TARGET=http://127.0.0.1:8080
VITE_ENABLE_MOCKS=false
```

更换前端端口/域名时，同步设置后端 `MUSEUM_ALLOWED_ORIGINS`。旧的 `VITE_MOCK_AUTH` 不再用于真实/模拟混合接入；模式由 `VITE_ENABLE_MOCKS` 统一控制。

## 已接入与未开放功能

已接入注册、登录、会话恢复、退出、系列列表/详情/创建/图标、版本列表/详情/创建、截图上传/读取。支持详情补图，部分上传失败可重试剩余图片。

收藏、评论、草稿、个人主页/编辑资料、用户主页、版本编辑/修改历史、找回密码尚无后端接口，真实模式隐藏相关入口，不在页面标注开发状态。系列标签/来源和独立版本图标也尚无保存字段；资料链接可写入版本正文。

完整接口映射、限制及缺项见 [后端接入记录](../docs/backend-integration.md)。认证约定见 [OpenAPI](../docs/openapi.yaml)，业务接口见 `../backend/docs/`。

## 页面与结构

`src/pages/` 放页面，`src/components/` 放组件。`src/lib/request.js` 处理 HTTP、Cookie、multipart、错误和登录失效；`src/lib/backend-api.js` 转换真实后端字段、枚举和分页；`src/mocks/` 仅用于演示。

- `/`、`/series`：首页与目录，支持本地搜索、分类、首字母、排序和分页。
- `/series/:id`、`/versions/:id`：系列版本链、版本详情与截图。
- `/series/new`、`/publish?series=系列ID`：创建系列、发布版本。
- `/favorites`、`/profile`、`/contributors/:id`、`/drafts`、`/versions/:id/edit`：当前只在演示模式提供完整交互。

现阶段目录查询会读取后端全部分页以及系列版本，服务端搜索与版本统计尚待补齐，详见接入记录。

## 独立演示

```powershell
npm run dev:demo
```

演示账户：`museum@example.com` / `museum-passphrase-2026`，使用邮箱登录。MSW 数据保存在当前站点 IndexedDB，刷新后保留；清除站点数据可恢复种子数据。演示编辑、收藏、草稿、评论不写入真实后端。演示模式不产生真实 JWT 或邮件。

## 构建

```powershell
npm run build
```

正常构建默认使用真实接口。部署时将 `/api` 反向代理到后端，将页面路由回退到 `index.html`，并配置后端允许的 Origin 和 HTTPS Cookie。

独立演示构建：

```powershell
npm run build:demo
npm run preview
```

## 验证

```powershell
npm test
npm run lint
npx playwright install chromium
npm run test:e2e
```

单元测试覆盖真实接口契约及演示交互；默认 E2E 使用显式演示模式，覆盖桌面和手机尺寸。失败时在 `test-results/` 保存截图和 trace。

真实后端联调使用 `npm run test:e2e:backend`。先构建后端，再在独立临时目录启动隔离实例（PowerShell，另一个终端）：

```powershell
$integrationDir = Join-Path $env:TEMP ('museum-integration-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $integrationDir | Out-Null
Set-Location -LiteralPath $integrationDir
java -jar D:/repos/vintage-museum/backend/target/museum-backend-0.0.1-SNAPSHOT.jar --server.port=18080 '--spring.datasource.url=jdbc:h2:mem:frontend-integration;DB_CLOSE_DELAY=-1' '--museum.registration.allowed-origins=http://127.0.0.1:5191'
```

在前端目录执行：

```powershell
npm run test:e2e:backend
```

此测试会写入测试账户、系列、版本与截图，因此只应指向隔离实例。测试配置自动启动 5191 上的真实模式前端并代理到 18080，不占用开发页面的 5173 端口。可通过 `PLAYWRIGHT_PORT` 覆盖测试前端端口，同时须调整后端允许的 Origin。完成后停止临时后端，内存数据库随进程退出而释放。

`e2e-backend/collections.spec.js` 读取 `docs/collections/catalog.json`，通过页面提交全部系列、精选版本和精确关联的 PNG/JPG 截图，核对 201 响应、字段回读、图片尺寸和刷新展示；另验证 SVG 图标被表单和接口拒绝。历史参考图不挂到版本；非精确到日的日期保持为空，并把年份和来源写入正文。测试中的分类与平台映射及实际结果见 [资料库联调记录](../docs/collection-api-test.md)。

运行后可用 `npx playwright show-report playwright-report/backend` 查看报告；JSON 结果位于 `test-results/backend-results.json`。

如使用本机 Edge，可跳过浏览器下载，在执行测试前设置 `$env:PLAYWRIGHT_CHANNEL = 'msedge'`。
