# Scripts Index

这个目录存放开发和维护脚本。优先通过 `package.json` 中的 npm scripts 调用，避免直接绕过项目约定。

## 目录分布

- `dev/`：本地开发启动脚本。
- `build/`：构建后资源准备脚本。
- `package/`：关闭旧进程并打包发布的脚本。
- `setup/`：新机器环境检查、依赖安装和本地缓存规则。
- `qa/`：依赖、错误码和 MCP 文档读取等验证脚本。
- `importers/`：DOCX 批量导入和导入审计脚本。
- `mcp/`：外部 stdio MCP server，随安装包作为额外资源分发。
- `architecture-knowledge/`：开发侧架构知识库同步脚本。
- `github/`：GitHub 同步和 Release 资产检查脚本。
- `update/`：发布更新记录脚本。
- `npm-stubs/`：项目本地 npm stub 包。

MCP 本机调用：标准客户端直接启动 `mcp/aistudy-mcp-server.mjs` 并保持 stdio 会话。单次诊断可用 `mcp/call-aistudy-mcp.mjs`；连续调用应使用 `--session`，以复用同一个 Node 进程和 MySQL 连接池。Windows 下优先使用 `--ref`、`--course-name`、`--node-query`、`--query`、`--scope`、`--mode` 等直接参数。复杂对象使用 PowerShell `ConvertTo-Json -Compress | ... --args-stdin` 或 UTF-8 JSON 文件配合 `--args-file`；不要依赖 PowerShell 中的内联 `--args-json` 引号转义。`--args-json`、`--args-stdin`、`--args-file` 互斥，解析失败会在 MCP 调用前退出。`read_node_context` 默认只定向查询目标与祖先路径；只有显式要求后代时才加载整张节点表。快照缓存同时受条目数和字节数限制。

## 使用边界

- 需要安装依赖时使用 `npm run setup:install`。
- 新机器或打包前使用 `npm run setup:doctor`。
- 日常开发使用 `npm run dev:app`。
- 目录版验证使用 `npm run pack`；脚本会关闭旧实例、暂存便携运行数据、重建后恢复数据并刷新快捷方式。
- 发布前使用 `npm run dist:oneclick`。
- `pack:raw` 与 `dist:raw` 仅供打包保护脚本内部调用，禁止直接执行，避免清理 `release/win-unpacked` 时丢失便携运行数据。
- 同步 GitHub 前使用 `npm run github:sync:doctor`。
- 批量导入先 dry-run，再通过审计脚本确认后提交。
- 构建缓存必须放在项目本地忽略目录，不能写入系统盘缓存。
- MCP 参数、技术文本保真、全文完成状态、规划、权限、标题与 RAG 状态契约使用 `npm run qa:mcp-system-contracts` 验证。
