# AIstudy MCP 模块边界

MCP 现在按独立模块管理，主进程不再直接维护 MCP 工具状态机。

## 模块职责

`electron/mcp/controller.ts` 负责：

- MCP 工具定义。
- MCP 工具安全标注：只读、写入、幂等、外部访问提示。
- MCP 工具运行态：启停、running、success、error、idle。
- UI 控制台状态快照。
- IPC 入口实际调用。
- JSON-RPC `initialize`、`tools/list`、`tools/call`、`resources/list`、`resources/read`、`prompts/list`、`prompts/get`。
- MCP instructions、半自动向导工具、resources 和 prompts。
- 复制接入引导。
- stdio 请求队列和结束等待。
- 应用内置控制工具，例如 `copy_config`。

`electron/main.ts` 只负责：

- 创建 `mcpController`。
- 注入 AIstudy 业务能力，例如读取课程、读取导图、搜索节点、追加节点、健康检测。
- 保持 MCP 数据逻辑面向全库：读取、搜索、定位默认不依赖客户端当前选中项；编辑必须显式传入目标知识库。
- 注册 IPC handler。
- 在 `--aistudy-mcp` 模式下启动 MCP stdio 服务。
- 注入 Chrome 端口管理能力，例如读取端口状态、打开固定端口页面。

`scripts/mcp/aistudy-mcp-server.mjs` 负责：

- 外部 MCP 客户端的稳定入口。
- 打包后作为 `extraResources` 分发。
- 直接读取 AIstudy 数据目录和 MySQL。
- 暴露外部客户端真实会调用的工具清单。
- 提供 Chrome 端口管理工具：`chrome_ports_status`、`chrome_port_open_page`。

Local stdio boundary: `scripts/mcp/aistudy-mcp-server.mjs` uses line-delimited JSON-RPC, one JSON object per line. It is intentionally not a `Content-Length` framed transport. Use `scripts/mcp/call-aistudy-mcp.mjs` for ad-hoc same-machine calls.

`electron/mcp/remoteAccess.ts` 负责：

- 设置页“内网访问”开关。
- 检测 Tailscale 安装、在线和登录状态。
- 启动本机 HTTP MCP 服务。
- 通过 `tailscale serve` 暴露到 tailnet。
- 远程工具权限白名单、token 校验和 Origin 校验。
- 远程编辑权限持久化：远程编辑总开关、知识库管理、导图编辑、文档写入、删除操作。

## 新功能放置规则

- 新增 MCP 工具：先在 `electron/mcp/controller.ts` 增加工具定义、安全标注和调用分支。
- 新增外部 stdio 工具：同步更新 `scripts/mcp/aistudy-mcp-server.mjs`。
- 需要 AIstudy 内部业务数据时：不要在 MCP 模块直接访问数据库，优先由 `main.ts` 注入函数。
- 需要调用系统能力时：由 `main.ts` 或外部脚本里明确封装，不要让 MCP 直接暴露任意系统命令。
- 涉及知识库范围时：默认支持全库；只有写入动作要求明确 `courseId`。
- 涉及编辑动作时：知识库/分区、导图节点、导图样式布局、节点文档都必须经过 MCP 编辑许可；删除类工具必须标注 destructive。
- 涉及 Chrome 端口时：AIstudy 只负责读取端口信息和打开页面，不在 MCP 里执行网页脚本。
- 需要给外部 Codex 使用时：同步更新 `docs/mcp/AIstudy-MCP-quickstart.md`。
- 单文件交接说明也要同步更新 `docs/mcp/AIstudy-MCP-access-skill.md`。
- 影响外部客户端上手流程时：同步更新 `mcp_get_started`、`mcp_plan_task`、`mcp_resolve_target`、resources 和 prompts，保证 Codex/Claude Code 接入后能自己读懂顺序。
- 影响内网访问时：同步更新 `docs/mcp/AIstudy-MCP-tailscale-access.md`，并保持远程入口默认只读。

## 当前工具分组

接入与规划：

- `mcp_get_started`
- `mcp_plan_task`
- `mcp_resolve_target`
- `health_check`
- `copy_config`

知识库与分区：

- `read_courses`
- `create_course`
- `rename_course`
- `move_course`
- `delete_course`
- `create_course_section`
- `rename_course_section`
- `move_course_section`
- `delete_course_section`

导图：

- `read_current_mindmap`
- `search_nodes`
- `read_node_context`
- `append_mindmap_node`
- `create_mindmap_node`
- `update_mindmap_node_text`
- `move_mindmap_node`
- `delete_mindmap_node`
- `update_mindmap_node_style`
- `update_mindmap_layout`

节点文档：

- `list_node_documents`
- `read_node_document`
- `write_node_document`
- `append_node_document`
- `format_node_document`
- `update_node_document_style`

读取边界：`read_current_mindmap`、`search_nodes`、`list_node_documents` 不允许因参数缺失自动扩大到全库；全库操作必须显式传 `scope: "all"`。`read_node_context` 默认不展开后代且只返回文档摘要，正文和子树按需开启。`read_node_document` 以 `text`、`snapshot`、`audit` 三种模式隔离普通读取、编辑器快照和完整诊断。

节点文档写入边界：`write_node_document` 和 `append_node_document` 接收干净、结构化文本或 Markdown 标题；内容应拆成一级标题、短步骤标题、字段标签、编号/项目列表和简洁正文；独立知识点之间必须空一行但不得用额外空行制造视觉间距；不得把 Mermaid 或 Markdown fenced block 原样写入正文，真实导图结构优先使用导图工具，文档内需要说明时改写成标题和稳定编号大纲，不依赖普通空格缩进或树形线条字符；数学内容必须使用规范符号和可读公式文本，例如 `ε`、`δ`、`∞`、`→`、`≤`、`≥`、`x_n`、`x^2`、`lim_{n→∞}`，不得把 `epsilon`、`infinity`、`->` 这类退化文本作为最终内容。

并发边界：文档服务在事务内使用行锁读取当前快照，并校验调用方的 `expectedSnapshotId`。MCP、用户文档页、教材载入和信息采集均复用该服务；冲突时拒绝旧版本写入。写入结果只返回版本、大小、长度和哈希等轻量元数据。

定位与交接：

- `resolve_course_locator`

Chrome 端口：

- `chrome_ports_status`
- `chrome_port_open_page`

## 验证顺序

1. `npm run qa:mcp-runtime-safety`
2. `npm run build`
3. 运行 `scripts/mcp/aistudy-mcp-server.mjs` 的 `initialize`、`tools/list`、`resources/list`、`prompts/list`、`mcp_get_started`。
3. 调用 `chrome_ports_status`，确认端口工具能返回平台和端口。
4. 在客户端界面里点击 MCP 控制台的工具卡片，确认状态灯有调用反馈。
5. 编辑类工具默认应被权限拦截。
