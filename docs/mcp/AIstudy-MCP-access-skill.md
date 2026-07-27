# AIstudy MCP 接入技能与使用说明

这一个文件同时给人和 Codex/Claude Code 看。另一台设备拿到这份文档，再拿到 AIstudy 复制出来的三行连接信息，就能按顺序接入 MCP、读取知识库、搜索导图节点、读取节点文档、打开固定端口 Chrome 页面，并在明确授权后编辑。

标准 agent skill 位于 `.claude/skills/aistudy-mcp-access/SKILL.md`，索引和同步检查表位于 `.claude/skills/aistudy-mcp-access/references/`。后续 MCP 工具或权限更新时，必须同步更新该 skill。

## read_node_document text fields

Use `read_node_document({ mode: "text" })` for one cleaned readable body. Use `mode: "snapshot"` for editor JSON and `mode: "audit"` only when auditing extraction behavior.

## Compact MCP node ref

AIstudy node-document copy may return a compact ref instead of a long `locatorPath`, for example:

```text
aistudy://node/c4fc3394/ba7672d3?map=mindmap_97c1
```

Use it directly with `read_node_context`:

```json
{"ref":"aistudy://node/c4fc3394/ba7672d3?map=mindmap_97c1","documentMode":"text","maxDepth":4,"maxNodes":120}
```

Use `read_node_document({ "ref": "...", "mode": "snapshot" })` only when the editor snapshot is required. Use `resolve_course_locator` only when another agent explicitly needs a local boundary file.

## Local stdio transport

When using `F:\XIANGMU\AIstudy-public\scripts\mcp\aistudy-mcp-server.mjs` directly, the transport is line-delimited JSON-RPC over stdio. Send one JSON-RPC object followed by `\n`, then read one JSON response per line.

Do not use standard MCP `Content-Length` framing with this local script. If a temporary client hangs after `initialize`, stop it and switch to line-delimited JSON-RPC.

For same-machine reads, use the maintained helper instead of writing a custom wrapper:

```powershell
node F:\XIANGMU\AIstudy-public\scripts\mcp\call-aistudy-mcp.mjs --ref "aistudy://node/c4fc3394/ba7672d3?map=mindmap_97c1" --max-depth 4 --max-nodes 120
```

## 给 Codex/Claude Code 的 Skill 提示

```text
Skill name: aistudy-mcp-access

Use this skill when connecting Codex, Claude Code, Cursor, or another AI assistant to an AIstudy MCP endpoint over local stdio, HTTP, or Tailscale LAN access.

Core rule:
Treat AIstudy MCP as a full-library knowledge system, not as the user's currently selected UI page. Always discover the target first, then read, then edit only with explicit permission.

Workflow:
1. Collect the connection shape.
   - HTTP/Tailscale: MCP URL, optional API URL, Authorization: Bearer ...
   - Local stdio: server script path, data root, app root, and edit flag.
   - Local script transport: line-delimited JSON-RPC, not Content-Length MCP framing.
2. Verify reachability before doing useful work.
   - HTTP: confirm the host is reachable and the token is present.
   - stdio: confirm Node.js can run the server script and the AIstudy data root exists.
3. Start read-only.
   - Call mcp_get_started.
   - Call read_courses.
   - Resolve a target with mcp_resolve_target before reading a specific knowledge base.
4. Read in this order.
   - read_current_mindmap with courseId for the target knowledge base.
   - search_nodes with courseId and the user's keyword.
   - read_node_context when courseId and nodeId are known; it returns ancestors, subtree, and node-bound documents in one structured payload.
   - list_node_documents, then read_node_document only when a full single-node document snapshot is required.
5. Open browser ports only through AIstudy port management.
   - Call chrome_ports_status first.
   - Call chrome_port_open_page with platformId and optional url.
   - AIstudy only opens the page; the external assistant handles page actions.
6. Edit only when the user has clearly allowed it.
   - Confirm the remote edit permission group is enabled in AIstudy settings.
   - Use exact courseId and, for document edits, exact nodeId.
   - Prefer append/update tools over destructive tools.
   - After editing, re-read the affected course/node/document.

Safety defaults:
- Do not invent courseId, nodeId, or local paths.
- Do not rely on the AIstudy UI selected course.
- Do not use destructive tools unless the user explicitly asks.
- If the endpoint is remote, assume read-only until settings say otherwise.
- If a request lacks a target, call mcp_resolve_target or ask for the knowledge base name.
```

## 需要从 AIstudy 复制的三行

在 AIstudy 打开：

```text
设置 -> MCP 控制台 -> 内网访问
```

开启后复制：

```text
MCP URL: ...
API URL: ...
Authorization: Bearer ...
```

另一台设备必须先登录同一个 Tailscale 网络。AIstudy 所在机器要保持应用打开，内网访问也要保持开启。

## 给另一台 Codex 的推荐提示词

```text
请按下面这份 AIstudy MCP 接入说明操作。先只读，不要编辑，除非我明确允许。

MCP URL: ...
API URL: ...
Authorization: Bearer ...

第一步调用 mcp_get_started，然后 read_courses，再用 mcp_resolve_target 确认目标知识库。需要打开网页时先调用 chrome_ports_status，再调用 chrome_port_open_page。
```

## HTTP MCP 配置示例

```json
{
  "mcpServers": {
    "aistudy": {
      "type": "http",
      "url": "http://<tailscale-name-or-ip>:6188/mcp",
      "headers": {
        "Authorization": "Bearer <token>"
      }
    }
  }
}
```

## 本机 stdio 配置示例

同一台机器上使用时可以走本地脚本：

```json
{
  "mcpServers": {
    "aistudy": {
      "command": "node",
      "args": [
        "F:\\XIANGMU\\AIstudy-public\\scripts\\mcp\\aistudy-mcp-server.mjs"
      ],
      "env": {
        "AISTUDY_PUBLIC_DATA_ROOT": "F:\\XIANGMU\\AIstudy-public\\.runtime",
        "AISTUDY_APP_ROOT": "F:\\XIANGMU\\AIstudy-public",
        "AISTUDY_MCP_ALLOW_EDIT": "0"
      }
    }
  }
}
```

`AISTUDY_MCP_ALLOW_EDIT=1` 只在明确要编辑时开启。

Local stdio protocol note: `scripts/mcp/aistudy-mcp-server.mjs` reads and writes one JSON-RPC object per line. Do not frame local stdio messages with `Content-Length`.

## 第一次使用顺序

1. `mcp_get_started`：确认服务、权限、数据状态。
2. `read_courses`：读取全库列表。
3. `mcp_resolve_target`：用知识库名称、课程 ID 或关键词解析目标。
4. `read_current_mindmap`：读取指定知识库导图。
5. `search_nodes`：搜索节点。
6. `list_node_documents`：查看节点文档。
7. `read_node_document`：读取节点文档。
8. `chrome_ports_status`：需要网页端口时，先读取 AIstudy 端口管理信息。
9. `chrome_port_open_page`：按平台打开固定端口 Chrome 页面。

编辑前额外调用 `mcp_plan_task`，让 AIstudy 返回建议工具顺序；编辑完成后重新读取目标内容确认结果。

## MCP 功能总览

### 接入、规划、健康检测

- `mcp_get_started`：新客户端第一步调用，返回健康状态、全库概览、安全规则、推荐下一步、resources 和 prompts。
- `mcp_plan_task`：把用户意图整理成 MCP 工具调用顺序，适合编辑前使用。
- `mcp_resolve_target`：按知识库名、`courseId`、节点关键词解析真实目标，避免猜 ID。
- `health_check`：检查数据目录、MySQL、数据库和核心表状态。
- `copy_config`：应用内置 MCP 控制器工具，用于复制接入引导；通常通过 AIstudy 设置页按钮使用。独立 `scripts/mcp/aistudy-mcp-server.mjs` 不依赖它。

只读：

- `read_courses`
- `read_current_mindmap`
- `search_nodes`
- `read_node_context`
- `list_node_documents`
- `read_node_document`

### 知识库和分区管理

- `read_courses`：读取全库分区和知识库清单。
- `create_course`：创建知识库。
- `rename_course`：修改知识库名称、描述或所属分区。
- `move_course`：移动知识库到指定分区或排序位置。
- `delete_course`：删除知识库，属于破坏性操作。
- `create_course_section`：创建分区。
- `rename_course_section`：修改分区名称。
- `move_course_section`：调整分区顺序。
- `delete_course_section`：删除分区，属于破坏性操作。

### 思维导图读取和编辑

- `read_current_mindmap`：传完整 `courseId` 读取目标导图；只有明确全库读取时才传 `scope: "all"`。
- `search_nodes`：传 `courseId` 定向搜索；跨库搜索必须显式传 `scope: "all"` 和非空 `query`。
- `read_node_context`：已知 `courseId + nodeId` 时优先使用；默认以定向路径查询返回目标节点、父级路径和文档摘要，不解析完整导图快照，子树和正文按需开启。
- `append_mindmap_node`：在指定知识库导图根节点追加节点。
- `create_mindmap_node`：在指定父节点下新增节点。
- `update_mindmap_node_text`：修改节点标题。
- `move_mindmap_node`：移动节点到新父节点和排序位置。
- `delete_mindmap_node`：删除节点及其子节点，属于破坏性操作。
- `update_mindmap_node_style`：设置节点颜色、字号、粗斜体、删除线、自动换行宽度等。
- `update_mindmap_layout`：切换导图布局。

### 节点文档

- `list_node_documents`：列出全库或指定知识库里已有节点文档。
- `read_node_document`：默认 `mode: "text"` 只返回一份清理正文；`mode: "snapshot"` 返回编辑器快照；`mode: "audit"` 返回完整诊断字段。
- `write_node_document`：创建节点文档或在明确授权时覆盖整篇。节点已有内容时，必须显式传 `replaceExisting: true` 才允许覆盖；不要把它当作“排版工具”使用。
- `append_node_document`：在节点文档末尾追加干净文本或 Markdown 标题。
- `format_node_document`：只应用中国文章字体、标题层级、对齐和行距。它必须逐字保留每一个编辑器元素的 `value`，不得改写文字、修剪空白、删除空行、插入空行、补写首行缩进字符、拆段或合段。
- `update_node_document_style`：只做全文字号、颜色、粗体、斜体、下划线等简单样式调整；不得拆段、加空行或重写内容。

文档写入规则：

- 不要手写 canvas-editor 内部元素来拼排版。
- 不要在 `value` 中塞大量 `\n\n` 来制造间距。
- 不要为了“改排版”调用 `write_node_document` 覆盖整篇文档。
- 节点已有文档时，`write_node_document` 默认会拒绝覆盖；只有用户明确要求“整篇重写/覆盖”时才传 `replaceExisting: true`。
- 已有文档的覆盖、追加、排版和样式写入必须携带最近一次读取返回的 `currentSnapshotId` 作为 `expectedSnapshotId`；版本不一致时返回 `DOCUMENT_VERSION_CONFLICT`。
- 显式 `courseId`、`mindMapId`、`nodeId` 必须使用完整 ID；短前缀只允许放在紧凑引用中，并且必须唯一匹配。
- 新内容写入用 `write_node_document`，补内容用 `append_node_document`，不改内容的样式清理用 `format_node_document`，简单全文样式用 `update_node_document_style`。
- `write_node_document` 和 `append_node_document` 的 `text` 必须保持干净并结构化。节点名称已经作为文档抬头，正文默认不重复；只有独立文章标题才写 `# 标题`。使用 `一、`、`（一）`、`1.`、`（1）` 四级标题、`> ` 引用、`目标：`/`数据来源：` 字段标签、列表和逐段正文。每行是一段自然正文，空输入行只标记段落边界，系统通过比例行距而不是可见空白行分段。新正文自动应用宋体、两字符首行缩进、两端对齐和中文标点；中英文相邻间距会安全规范化，同时保护 URL、Windows 路径、邮箱、代码、公式、列表符号和树形缩进。
- 数学内容必须使用规范符号和可读公式文本，例如 `ε`、`δ`、`∞`、`→`、`≤`、`≥`、`x_n`、`x^2`、`lim_{n→∞}`、`|x_n-a| < ε`。不要把 `epsilon`、`delta`、`infinity`、`->`、`lim_{n->infinity}` 原样写入最终文档。
- `format_node_document` 写入前必须校验元素数量一致、所有 `value` 逐字一致；校验失败必须中断，不得写入。
- MCP 不把“清理空行、补写缩进字符、重排段落”当作已有文档的安全排版。需要改变正文结构时，必须先读全文、让用户确认，再用 `write_node_document` 重建整篇。

### 本地定位和交接

- `resolve_course_locator`：生成本地定位文件，给另一个 Codex/Claude 快速找到知识库数据边界。定位文件里的数据库名和表名是公开版固定边界元数据，不是可覆盖配置；不要用 UI 面包屑代替它。

### Chrome 端口管理

- `chrome_ports_status`：读取 AIstudy 端口管理信息，包含豆包、ChatGPT、Bilibili、知乎、智联招聘、BOSS直聘、小红书的平台 ID、固定端口、默认地址、连接状态和当前检测页面。
- `chrome_port_open_page`：按 `platformId` 和可选 `url` 启动或复用固定端口 Chrome 页面。AIstudy 只负责打开页面，不执行网页脚本。

可用 `platformId`：

- `doubao`
- `chatgpt`
- `bilibili`
- `zhihu`
- `zhaopin`
- `zhipin`
- `xiaohongshu`

示例：

```json
{
  "platformId": "zhihu",
  "url": "https://www.zhihu.com/"
}
```

### MCP resources 和 prompts

支持 resources 的客户端可以读取：

- `aistudy://guide/start`
- `aistudy://guide/workflows`
- `aistudy://guide/safety`
- `aistudy://schema/tools`

支持 prompts 的客户端可以使用：

- `aistudy_start`
- `aistudy_read_knowledge`
- `aistudy_edit_mindmap`
- `aistudy_edit_document`

### 普通 HTTP 只读 API

开启内网访问后，除 `/mcp` 外还提供普通只读 API：

- `GET /api/courses`
- `GET /api/courses/:courseId/mindmap`
- `GET /api/courses/:courseId/search?q=关键词`
- `GET /api/courses/:courseId/nodes/:nodeId/document`

## 编辑权限

远程 MCP 默认只读。需要编辑时，在 AIstudy 设置页打开对应权限：

- 远程编辑
- 知识库管理
- 导图编辑
- 文档写入
- 删除操作

编辑必须明确目标知识库 `courseId`。文档编辑还必须明确 `nodeId`。删除操作需要单独确认。

## 常见问题

- TCP 超时：AIstudy 没开、内网访问没开、Tailscale 没在线，或 `6188` 没暴露成功。
- 401/403：token 错了，或请求头没有带 `Authorization`。
- 能读不能写：远程编辑权限没开，这是默认安全状态。
- `dataRootExists=false`：本地数据目录路径错了。
- `MCP requires an explicit knowledge base`：编辑调用没有传 `courseId`。
- 找不到目标知识库：先用 `read_courses` 和 `mcp_resolve_target`，不要猜 ID。
- `Unknown tool: copy_config`：当前连接的是独立 `scripts/mcp` 服务，复制配置请在 AIstudy 设置页完成。
- `Chrome executable is missing`：端口管理 MCP 找不到 Chrome，可设置 `AISTUDY_CHROME_PATH`。

## 回复用户时的口径

优先说知识库名称和节点标题。只有需要继续调用工具时，才把 `courseId`、`nodeId` 放在括号里。
