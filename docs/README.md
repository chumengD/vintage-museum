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

当前认证文档已同步后端的用户名登录与 30 分钟 Cookie。系列、版本、截图接口详见 `../backend/docs/`；前后端接入进度、缺项和验证结果见 [接入记录](backend-integration.md)。

- `docs/collections/`：[数字博物馆资料总目录](collections/README.md)，图片与版本资料按产品系列收纳（QQ、微信、Windows、MSN、Android、iOS 等）。
- `docs/collections/<系列名>/images/`：该系列的全部已采集图片；同级 `README.md` 提供版本与图片对照。
- `docs/collections/_archive/`：原始采集批次与旧 ZIP 备份，日常查找请使用上面的系列目录。
- `docs/openapi.yaml`：api文档，日常编辑这个文件。
- `docs/README.md`：使用说明。
- `docs/wagger/index.html`：Swagger UI 页面。
- `docs/wagger/scripts/`：构建脚本。
- `docs/wagger/package.json` 和 `package-lock.json`：工具依赖与启动命令。
- `docs/wagger/dist/`：构建产物，自动生成。
- `docs/wagger/node_modules/`：本地依赖，自动安装。



