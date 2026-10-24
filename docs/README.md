## 启动文档页面

需要 Node.js/npm。在 PowerShell 运行：

```powershell
cd vintage-museum\docs\wagger
npm start
```

打开 <http://127.0.0.1:18191/>

第一次重新下载项目时，先在同一目录运行 `npm install` 安装依赖，再运行 `npm start`。

修改 `docs/openapi.yaml` 后，停止并重新启动即可更新。

## 文件组织

- `docs/openapi.yaml`：api文档，日常编辑这个文件。
- `docs/README.md`：使用说明。
- `docs/wagger/index.html`：Swagger UI 页面。
- `docs/wagger/scripts/`：构建脚本。
- `docs/wagger/package.json` 和 `package-lock.json`：工具依赖与启动命令。
- `docs/wagger/dist/`：构建产物，自动生成。
- `docs/wagger/node_modules/`：本地依赖，自动安装。



