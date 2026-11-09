# 旧时博物馆前端

按 `../docs/设计稿/` 实现。React + Vite + Tailwind CSS 4；弹窗、菜单、选择框、复选框和提示确认使用 Radix UI；日历使用 React DayPicker，正文使用 react-markdown。

## 启动

```powershell
cd D:\repos\vintage-museum\frontend
npm install
npm run dev
```

打开终端显示的本地地址。开发模式默认使用 MSW 演示 API，演示账户为：

- 邮箱：`museum@example.com`
- 密码：`museum-passphrase-2026`

可以注册其他演示账户。开发模式的登录状态只是模拟数据，不产生真实 JWT 或邮件。用户的模拟编辑、收藏、草稿、评论和上传图片保存在当前站点 IndexedDB，刷新后保留。清除浏览器该站点的数据可恢复种子数据。

## 页面及结构

每个页面独立放在 `src/pages/`，组件位于 `src/components/`。`src/lib/` 包含请求客户端、数据 hook 和分类常量，`src/mocks/` 包含 MSW 与演示存储。

| 路由                 | 页面                                              |
| -------------------- | ------------------------------------------------- |
| `/`                  | 首页、馆藏剪报与检索                              |
| `/series`            | 全部系列、分类／首字母筛选、搜索、排序、分页      |
| `/series/:id`        | 系列详情、按平台独立的版本链                      |
| `/versions/:id`      | 版本详情、收藏、讨论回复、贡献者与修改历史        |
| `/publish`           | 发布版本；支持 `?series=firefox`、`?draft=草稿ID` |
| `/versions/:id/edit` | 编辑版本并留存修改前正文                          |
| `/series/new`        | 创建系列、图标、多选平台、Markdown、草稿          |
| `/favorites`         | 系列／内容收藏、搜索与排序                        |
| `/profile`           | 我的主页、编辑资料、发布与草稿索引                |
| `/contributors/:id`  | 可分享的公开档案                                  |
| `/drafts`            | 恢复和删除草稿                                    |
| `/about`             | 本馆说明                                          |

全局提供设计稿中的登录／注册弹窗和头像下拉菜单。移动端使用单列重排；Radix 保留 Escape、焦点约束、返回焦点和键盘导航。日历支持键盘选择，也可直接输入日期。

## 对接真实后端

已约定的登录接口遵循 `../docs/openapi.yaml`：`register`、`login`、`me`、`logout`。请求携带 Cookie，不读取或存储真实 JWT。注册成功返回登录；退出成功清除前端用户态。

创建 `.env.development.local`：

```dotenv
VITE_MOCK_AUTH=false
API_TARGET=http://localhost:8080
```

重启开发服务器。登录请求将经 Vite `/api` 代理转发；后端需要允许当前浏览器 Origin，并正确设置 Cookie。缺失的业务接口仍由 MSW 模拟。实际后端地址可修改 `API_TARGET`。

`记住登录状态`遵循当前接口的固定 2 小时有效期，不会擅自延长 Cookie。找回密码没有正式接口，仅模拟提交，不发真实邮件。

临时业务接口字段见 `../docs/frontend-mock-api.md`。

## 构建

```powershell
npm run build
```

普通生产构建不会启动 MSW；部署时需实现业务 API，将 `/api` 路由到后端，并将页面路由回退到 `index.html`。

如需独立可演示的静态构建：

```powershell
npm run build:demo
npm run preview
```

演示构建显式包含模拟接口，不适合作为真实账户系统。

## 验证

```powershell
npm test
npm run lint
npx playwright install chromium
npm run test:e2e
```

Vitest + Testing Library 覆盖 API 错误／权限／注册／历史保留、登录错误与键盘菜单、筛选空状态、Markdown 安全渲染、图片大小限制及日期选择框。

Playwright 在桌面 Chromium 和手机尺寸 Chromium 下验证完整浏览、登录焦点、收藏、评论回复、编辑留存、创建系列、草稿恢复、图片上传、发布和刷新持久化；逐页检查横向溢出，覆盖公开档案、编辑资料及草稿删除确认。截图保存在 `test-results/`，失败时另有 trace。

设计稿中的 Firefox 浏览器界面以 HTML 重建为示意图，并明确标注非原始截图；其余软件在没有上传资料时显示待补充状态。没有将整张设计稿当成页面背景使用。
