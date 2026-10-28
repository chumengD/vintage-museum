# Vintage Museum 前端

基于 React + Vite（JavaScript），使用 ESLint 检查代码，支持热更新。

## 本地开发

在当前 frontend 目录执行：

```powershell
npm install
npm run dev
```

打开终端输出的本地地址（通常为 http://localhost:5173）。

## 常用命令

```powershell
npm run lint     # 检查代码
npm run build    # 构建到 dist 目录
npm run preview  # 本地预览构建结果
```

## 项目结构

```text
public/           静态资源
src/assets/       由 Vite 处理的资源
src/App.jsx       根组件，后续业务页面从这里开始
src/App.css       根组件样式
src/index.css     全局样式
src/main.jsx      React 入口
index.html        HTML 入口
vite.config.js    Vite 配置
eslint.config.js  ESLint 配置
```

首次搭建保留官方示例页面，便于确认 React 渲染和热更新正常。

若 npm create vite 的自动安装出现 EALLOWSCRIPTS，进入项目目录单独运行 npm install。该错误发生在 npm 的脚本权限配置检查阶段，与 React 组件代码无关。
