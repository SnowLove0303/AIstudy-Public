# AIstudy MCP 新手接入引导

这份文档给完全不了解 MCP 的 Codex、Claude、Cursor 使用者看。目标是先接通、先验证、再读取，最后才考虑编辑。

如果是给另一台 Codex 直接接入，优先把单文件说明发给它：`docs/mcp/AIstudy-MCP-access-skill.md`。

项目内标准 MCP 接入 skill 位于 `.claude/skills/aistudy-mcp-access/SKILL.md`；后续 MCP 功能更新时，同步清单见 `.claude/skills/aistudy-mcp-access/references/sync-checklist.md`。

## 先理解一句话

AIstudy MCP 是一个本地工具入口，让外部 AI 助手可以读取和管理 AIstudy 的全库知识库、思维导图、节点搜索结果、节点文档，也可以通过 AIstudy 的端口管理打开固定端口 Chrome 页面。

默认是只读模式，不会修改导图。编辑能力必须显式开启 `AISTUDY_MCP_ALLOW_EDIT=1`，并传入明确的 `courseId` 和目标节点。

Chrome 端口能力只负责打开页面，不负责网页内点击、输入或读取。页面内动作由外部 Codex、Claude 或 Cursor 自己接管。

客户端连接后会收到 `instructions`，也可以通过 MCP `resources` 和 `prompts` 读取固定流程。最省心的办法是让外部智能体第一步调用 `mcp_get_started`。

## 接入前检查

先确认三件事：

- Node.js 能运行。
- `scripts/mcp/aistudy-mcp-server.mjs` 存在。
- AIstudy 数据目录存在，开发态通常是 `F:\XIANGMU\AIstudy-public\.runtime`，打包态通常在 `release\win-unpacked\AIstudyPublicData` 或应用生成的数据目录。

## 客户端配置

### Codex CLI（本机推荐）

Codex 的 Skill 与 MCP 注册是两层能力：Skill 负责指导工具选择和安全流程，MCP 注册负责真正提供 `aistudy` 工具。两者必须同时存在。

项目 Skill 是版本化事实源：

```text
F:\XIANGMU\AIstudy-public\.claude\skills\aistudy-mcp-access
```

本机 Codex 加载目录是：

```text
F:\AIAPP\Codex\.codex-home\skills\aistudy-mcp-access
```

先把旧的加载目录备份到 F 盘，再将完整项目 Skill 同步过去。随后用 Codex CLI 注册只读 MCP：

```powershell
$env:CODEX_HOME = "F:\AIAPP\Codex\.codex-home"

codex mcp add `
  --env AISTUDY_PUBLIC_DATA_ROOT=F:\XIANGMU\AIstudy-public\.runtime `
  --env AISTUDY_APP_ROOT=F:\XIANGMU\AIstudy-public `
  --env AISTUDY_MCP_ALLOW_EDIT=0 `
  aistudy -- `
  E:\MorenAnzhuangLujing\Huangjingdajian\Nodejs\node.exe `
  F:\XIANGMU\AIstudy-public\scripts\mcp\aistudy-mcp-server.mjs
```

使用 `codex mcp add`、`codex mcp list` 和 `codex mcp remove` 管理注册，不要为普通接入直接修改 Codex TOML。注册或更新 Skill 后要新开 Codex 任务，旧任务不会自动加载新的工具和指令。

人工验收流程见 `AIstudy-MCP-Codex-manual-test.md`。

### 其他客户端

支持 `mcpServers` JSON 的客户端可以使用这个结构：

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

如果你的客户端使用 TOML，把字段按同样含义映射：

```toml
[mcp_servers.aistudy]
command = "node"
args = ["F:\\XIANGMU\\AIstudy-public\\scripts\\mcp\\aistudy-mcp-server.mjs"]

[mcp_servers.aistudy.env]
AISTUDY_PUBLIC_DATA_ROOT = "F:\\XIANGMU\\AIstudy-public\\.runtime"
AISTUDY_APP_ROOT = "F:\\XIANGMU\\AIstudy-public"
AISTUDY_MCP_ALLOW_EDIT = "0"
```

## Local stdio protocol

The local script `scripts/mcp/aistudy-mcp-server.mjs` uses line-delimited JSON-RPC over stdio. Write one JSON-RPC object plus `\n`, then read one JSON object per line.

Do not use `Content-Length` framing against this local script. If a self-written client hangs after `initialize`, stop it and switch to line-delimited JSON-RPC.

For quick local reads, use:

```powershell
node F:\XIANGMU\AIstudy-public\scripts\mcp\call-aistudy-mcp.mjs --ref "aistudy://node/c4fc3394/ba7672d3?map=mindmap_97c1" --max-depth 4 --max-nodes 120
```

PowerShell 传复杂对象时不要把 JSON 直接拼进 `--args-json`。优先通过标准输入或 UTF-8 JSON 文件传递，避免引号在 Node 收到参数前被 PowerShell 消耗：

```powershell
@{
  courseId = "course_xxx"
  nodeId = "node_xxx"
  documentMode = "text"
} | ConvertTo-Json -Compress | node F:\XIANGMU\AIstudy-public\scripts\mcp\call-aistudy-mcp.mjs --tool read_node_context --args-stdin

node F:\XIANGMU\AIstudy-public\scripts\mcp\call-aistudy-mcp.mjs --tool read_node_context --args-file F:\path\to\arguments.json
```

`--args-json`、`--args-stdin`、`--args-file` 三者只能选一个；解析失败时辅助脚本会在调用 MCP 前明确退出，不会用空参数继续执行。`--session` 不能与 `--args-stdin` 共用，因为持续会话占用同一个标准输入。

## 第一次运行顺序

1. 调用 `mcp_get_started`，读取健康状态、全库概览、安全规则和下一步建议。
2. 调用 `read_courses`，确认能看到全库分区和知识库清单，并记住目标知识库的 `courseId`。
3. 调用 `mcp_resolve_target`。按知识库名、`courseId` 或节点关键词解析真实目标，减少猜参数。
4. 调用 `read_current_mindmap`。定向读取传完整 `courseId`；只有明确需要全库摘要时才传 `scope: "all"`。
5. 调用 `search_nodes`。定向搜索传 `courseId`；跨库搜索必须显式传 `scope: "all"` 和非空 `query`。
6. 已知 `courseId + nodeId` 时优先调用 `read_node_context`。默认通过定向查询只读取目标、父级路径和文档摘要，不解析完整导图快照；子树及正文按需开启。需要一次取得目标范围内所有文档全文时显式传 `documentMode: "full"`，并检查顶层 `completion.complete`。
7. 普通正文读取使用 `read_node_document({ mode: "text" })`；只有需要编辑器 JSON 时才用 `mode: "snapshot"`。每次读取都要检查 `complete`；若为 `false`，按 `requiredNextCall` 或 `nextOffset` 继续读取，不能把截断片段当全文。
7. 需要打开网页端口时，先用 `chrome_ports_status` 读取平台和端口，再用 `chrome_port_open_page` 打开页面。
8. 需要编辑时，先调用 `mcp_plan_task` 规划工具顺序；写入必须传 `courseId`，节点文档写入还必须传 `nodeId`。

## 工具范围

### 半自动向导和健康检查

- `mcp_get_started`
- `mcp_plan_task`
- `mcp_resolve_target`
- `health_check`
- `copy_config`：应用内置 MCP 控制器可用，通常通过设置页“复制接入配置”使用；独立 `scripts/mcp` 服务不依赖它。

### 知识库管理

- `read_courses`
- `create_course`
- `rename_course`
- `move_course`
- `delete_course`
- `create_course_section`
- `rename_course_section`
- `move_course_section`
- `delete_course_section`

### 导图管理

- `read_current_mindmap`
- `search_nodes`
- `read_node_context`
- `create_mindmap_node`
- `append_mindmap_node`
- `update_mindmap_node_text`
- `move_mindmap_node`
- `delete_mindmap_node`
- `update_mindmap_node_style`
- `update_mindmap_layout`

### 节点文档

- `list_node_documents`
- `read_node_document`
- `write_node_document`
- `append_node_document`
- `format_node_document`
- `update_node_document_style`

文档工具分工：

- 写新内容：`write_node_document`
- 追加内容：`append_node_document`
- 不改内容的样式清理：`format_node_document`
- 简单全文样式：`update_node_document_style`

`write_node_document` 和 `append_node_document` 的 `text` 应保持干净并结构化。节点名称已作为文档抬头，正文默认不重复；只有独立文章标题才写 `# 标题`。使用 `一、`、`（一）`、`1.`、`（1）` 四级标题、`> ` 引用、`目标：`/`数据来源：` 等字段标签、列表和逐段正文。每行是一段自然正文，输入空行只标记段落边界，系统通过行距而不是可见空白行分隔段落。新写入和追加正文自动应用宋体、两字符首行缩进、两端对齐和中文标点，中英文相邻处安全留白；URL、Windows 路径、邮箱、代码、公式、列表符号和树形缩进不改写。真实导图结构优先使用导图工具；数学内容使用 `ε`、`δ`、`∞`、`→`、`≤`、`≥`、`x_n`、`x^2`、`lim_{n→∞}` 等规范表达。

Windows 路径、UNC 路径、紧凑引用、JSON、命令行开关、带下划线的工具名/字段名和脚本文件名属于精确技术文本。写入、追加和回读必须逐字符保持，不允许把反斜杠移除、把下划线转成下标字符或对标识符做中文排版替换。

不要为了排版调用 `write_node_document` 重写整篇文档；节点已有内容时，`write_node_document` 默认拒绝覆盖，只有用户明确要求整篇覆盖时才传 `replaceExisting: true`。不要手写编辑器内部元素或用大量空行制造间距。`format_node_document` 只应用中国文章字体、标题层级、对齐和行距，必须保证元素数量一致、所有 `value` 逐字不变；因此它不能清理空行、补写首行缩进字符、拆段或合段。

### 本地定位

- `resolve_course_locator`

### Chrome 端口管理

- `chrome_ports_status`
- `chrome_port_open_page`

平台 ID：

- `doubao`：豆包，默认端口 `9224`
- `chatgpt`：ChatGPT，默认端口 `9230`
- `bilibili`：Bilibili，默认端口 `9231`
- `zhihu`：知乎，默认端口 `9232`
- `zhaopin`：智联招聘，默认端口 `9233`
- `zhipin`：BOSS直聘，默认端口 `9234`
- `xiaohongshu`：小红书，默认端口 `9235`

示例：

```json
{
  "name": "chrome_port_open_page",
  "arguments": {
    "platformId": "bilibili",
    "url": "https://www.bilibili.com/"
  }
}
```

### 普通 HTTP 只读 API

开启内网访问后，还可以用这些普通 API 做只读访问：

- `GET /api/courses`
- `GET /api/courses/:courseId/mindmap`
- `GET /api/courses/:courseId/search?q=关键词`
- `GET /api/courses/:courseId/nodes/:nodeId/document`

## 推荐给 Codex 的第一句提示

```text
你已经接入 AIstudy MCP。请先调用 aistudy.mcp_get_started，再按返回的 nextSteps 做只读探测；除非我明确允许，不要进行编辑。
```

## 可读资源和提示词

支持 MCP resources/prompts 的客户端可以直接读取：

- `aistudy://guide/start`
- `aistudy://guide/workflows`
- `aistudy://guide/safety`
- `aistudy://schema/tools`

可用提示词：

- `aistudy_start`
- `aistudy_read_knowledge`
- `aistudy_edit_mindmap`
- `aistudy_edit_document`

## 常见任务怎么走

### 读取全库

`mcp_get_started` -> `read_courses` -> `read_current_mindmap({ scope: "all" })`

### 读取指定知识库

`read_courses` -> `mcp_resolve_target` -> `read_current_mindmap({ courseId })`

### 搜索节点并读文档

`mcp_resolve_target({ courseName, nodeQuery })` -> `search_nodes({ courseId, query })` -> `read_node_context`

`read_node_context` 是节点级读取的优先工具：默认通过递归路径查询返回目标节点、父级路径和关联文档摘要，不加载整张节点表或完整导图快照。只有任务确实需要时才传 `includeDescendants: true`、`documentMode: "text"` 或 `documentMode: "full"`。`summary`/`text` 模式可能要求后续读取，必须检查 `completion.complete` 与 `requiredNextCalls`；`full` 模式在安全总量上限内原子返回全文，超过上限会明确报错而不会静默截断。短 ID 只允许出现在紧凑引用中，显式 ID 参数必须传完整值。

### 编辑导图

`mcp_plan_task({ intent, allowEdit: true })` -> `mcp_resolve_target` -> 具体导图编辑工具 -> 重新读取导图确认结果

### 编辑文档

`mcp_resolve_target({ courseName, nodeQuery })` -> `read_node_document({ mode: "snapshot" })` -> 携带 `currentSnapshotId` 作为 `expectedSnapshotId` 调用写入工具 -> 需要正文时再用 `read_node_document({ mode: "text" })` 核对

### 打开网页端口

`chrome_ports_status` -> `chrome_port_open_page({ platformId, url? })`

## 编辑开关

编辑默认关闭：

```text
AISTUDY_MCP_ALLOW_EDIT=0
```

只有明确要写入时才改成：

```text
AISTUDY_MCP_ALLOW_EDIT=1
```

编辑工具覆盖知识库、分区、导图节点、导图样式布局和节点文档。调用前要说明目标知识库、`courseId`、节点 ID 和具体动作；调用后应立刻恢复只读模式。

可在总开关之上配置精确白名单，多个值使用逗号、分号或空白分隔：

```text
AISTUDY_MCP_ALLOWED_EDIT_TOOLS=write_node_document,append_node_document
AISTUDY_MCP_ALLOWED_COURSE_IDS=course_xxx
AISTUDY_MCP_ALLOWED_NODE_IDS=node_xxx
```

只要配置了任一范围白名单，缺少目标或目标不在白名单内都会以 `MCP_EDIT_POLICY_DENIED` 拒绝，不会回退成环境级全权限。`mcp_get_started.safety.editPolicy` 会返回当前实际生效的策略。

## 排障

- `dataRootExists=false`：数据目录路径填错了。
- `dataRootExists=false` 但 `mysql=true`：MCP 服务已启动，数据库能连上，但当前配置的数据目录不是 AIstudy 正在使用的目录。
- `mysql=false` 或启动报连接错误：MySQL 没启动，或配置指向了错误数据库。
- `MCP requires an explicit knowledge base.`：写入没有传入 `courseId`。MCP 不依赖客户端当前选中项，编辑必须明确目标知识库。
- `MCP edit calls are disabled by configuration.`：编辑权限没有打开，这是默认安全行为。
- `MCP_EDIT_POLICY_DENIED`：工具、知识库或节点不在当前精确编辑白名单内，或配置了范围白名单但请求没有携带目标。
- `resolve_course_locator` 返回的 `locatorPath`：这是给外部 Codex 使用的本地定位文件路径，里面包含数据目录、固定数据库名、固定表名和知识库 ID；其中数据库名和表名只是边界元数据，不代表公开版运行时支持覆盖库名或表名。
- `Unknown tool: copy_config`：当前连接的是独立 `scripts/mcp` 服务，复制接入配置请在 AIstudy 设置页里点按钮。
- Local stdio client hangs after `initialize`：客户端大概率用了 `Content-Length` MCP framing。改用 line-delimited JSON-RPC，或直接用 `scripts/mcp/call-aistudy-mcp.mjs`。
- `Chrome executable is missing`：Chrome 路径没找到，可配置 `AISTUDY_CHROME_PATH`。

## read_node_document text fields

Use `read_node_document({ mode: "text" })` for one cleaned readable body. Use `offset` and keep reading until `complete` is true. Use `mode: "snapshot"` for editor JSON and `mode: "audit"` only when auditing extraction behavior.

文档返回的 `title` 是有效标题：数据库标题为空或仍为通用“节点文档”时，会回退为节点名称；`storedTitle`、`nodeTitle`、`titleSource` 可用于审计来源。文档写入成功不等于 RAG 已同步；当前仓库未配置可验证的向量索引时，`ragIndex.status` 明确返回 `not_configured`，且 `synchronized=false`，不得据此声称检索已包含最新快照。

## Compact MCP node ref

AIstudy node-document copy may return a compact ref instead of a long `locatorPath`, for example:

```text
aistudy://node/c4fc3394/ba7672d3?map=mindmap_97c1
```

Use it directly for the fast default read:

```json
{"ref":"aistudy://node/c4fc3394/ba7672d3?map=mindmap_97c1","documentMode":"text","maxDepth":4,"maxNodes":120}
```

Preferred tool: `read_node_context`. Use `read_node_document({ "ref": "...", "mode": "snapshot" })` only when the editor snapshot is required. Use `resolve_course_locator` only when another agent explicitly needs a local boundary file.
