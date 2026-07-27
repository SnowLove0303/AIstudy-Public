# MCP 技术文本完整性与读取契约修复记录

日期：2026-07-27
基线：`c7d4c1c5f86415dfbe2c9ec71caae4dc2dd0ab23`
范围：AIstudy Public MCP stdio、应用内 MCP 控制器、节点文档读写契约、接入文档与真实契约验证。
排除项：不新增任何业务知识内容，不新增或修改业务节点，不修改外部项目代码，不执行数据库迁移、表结构调整、数据清理或真实文档写入。

## 一、PowerShell 复杂 JSON 参数传递不稳定

- 问题现象：内联 `--args-json` 中的双引号可能在 Node 进程接收前被 PowerShell 处理，合法 JSON 退化为无引号对象文本，导致解析失败或参数缺失。
- 复现条件：在 PowerShell 中把多字段对象直接作为 `--args-json` 参数传给 `call-aistudy-mcp.mjs`。
- 影响范围：所有依赖对象参数的本地辅助调用，尤其是 `read_current_mindmap`、`read_node_context`、`mcp_plan_task` 和 `mcp_resolve_target`。
- 涉及模块：`scripts/mcp/call-aistudy-mcp.mjs`、MCP 接入 Skill、快速接入与脚本文档、契约测试。
- 当前状态：已修复。新增互斥的 `--args-stdin` 与 `--args-file`；复杂对象推荐 PowerShell `ConvertTo-Json -Compress` 后通过标准输入传递。任何 JSON 解析失败都在 MCP 调用前明确退出，不会用空参数继续调用；`--session` 与 `--args-stdin` 明确互斥。

## 二、Windows 路径在文本归一化中被破坏

- 问题现象：`F:\...`、UNC 路径或其他反斜杠文本在写入、格式化或回读后可能出现断行、拼接或反斜杠消失。
- 复现条件：节点正文包含 Windows/UNC 路径，同时进入中文标点、中英文间距或文档提取清理链路。
- 影响范围：MCP 新建、追加、排版、回读以及应用内外两套文档转换路径。
- 涉及模块：`scripts/mcp/aistudy-mcp-server.mjs`、`electron/main.ts`、MCP 文档与契约测试。
- 当前状态：已修复。去除全局删除反斜杠的行为，并在排版规范化前保护 Windows/UNC 路径等精确技术文本；真实契约测试覆盖驱动器路径与 UNC 路径逐字符一致。

## 三、命令名、字段名和工具标识符被排版改写

- 问题现象：带下划线的工具名、字段名、ID 或脚本名可能被数学排版规则转换为 Unicode 下标字符，失去可复制执行性。
- 复现条件：普通文章文本中出现 `mcp_get_started`、`read_node_context`、`mindmap_xxx` 等技术标识符。
- 影响范围：所有从纯文本生成编辑器快照并再次提取正文的节点文档。
- 涉及模块：文档文本规范化函数、应用内外 MCP 文档读写链路、契约测试。
- 当前状态：已修复。工具名、字段名、ID、脚本/文件名、命令行开关和 JSON 均先作为精确技术文本保护；数学表达式的既有排版能力仍保留。

## 四、写入与回读字符长度不一致

- 问题现象：`write_node_document.textLength` 与随后 `read_node_document.textLength` 可能相差一个或多个字符。
- 复现条件：写入结果按输入或中间文本计数，而读取结果按最终清理正文计数。
- 影响范围：写入校验、内容完整性判断、调用方审计和自动化工作流。
- 涉及模块：stdio 写入结果、应用内 MCP 写入结果、文档正文提取与清理函数。
- 当前状态：已修复。写入和普通回读统一按最终规范化快照提取出的清理正文计数；精确技术文本不再被二次改写。

## 五、`read_node_context` 不能稳定一次返回完整节点文章

- 问题现象：调用方容易把摘要或受字符上限约束的 `documents` 当成目标节点/子树的完整正文。
- 复现条件：使用默认 `summary`、`text` 模式，或读取带后代节点的多文档上下文。
- 影响范围：依赖一次调用完成全文研读的 Codex、Claude、Cursor 和其他 MCP 客户端。
- 涉及模块：`read_node_context` 工具定义、stdio 实现、应用内控制器与主进程实现、接入文档。
- 当前状态：已修复。新增 `documentMode: "full"`，在 1,000,000 字符安全总量内原子返回目标范围全文；超过上限返回 `DOCUMENT_CONTEXT_TOO_LARGE`，不返回伪完整结果。其他模式返回顶层 `completion` 和必要的后续调用列表。

## 六、长文档截断依赖调用方主动猜测

- 问题现象：`maxDocumentChars` 截断后，如果调用方忽略 `textTruncated`，可能把片段当全文。
- 复现条件：正文长度超过单次返回上限，且客户端没有建立续读循环。
- 影响范围：长文章研读、审计、重写前置读取和多 Agent 协作。
- 涉及模块：`read_node_document`、`read_node_context`、工具 Schema、Skill 和使用文档。
- 当前状态：已修复。`read_node_document` 支持 `offset`，并返回 `textOffset`、`returnedTextLength`、`remainingTextLength`、`nextOffset`、`complete`、`requiredNextCall`；上下文返回 `completion.complete`、截断统计和 `requiredNextCalls`。调用方可以按明确状态续读，不再依赖猜测。

## 七、`mcp_plan_task` 返回无关 Chrome 步骤

- 问题现象：普通“打开并编辑节点文档”意图会因“打开”“页面”“点击”等宽泛词命中浏览器规划，返回端口工具。
- 复现条件：文档编辑意图中包含日常界面动词，但未表达浏览器、网页、网址或固定端口需求。
- 影响范围：Agent 工具选择、任务耗时、意外打开浏览器页面的风险。
- 涉及模块：`scripts/mcp/aistudy-mcp-server.mjs`、`electron/mcp/controller.ts`、契约测试。
- 当前状态：已修复。浏览器意图只由明确网页/浏览器/URL/端口语义触发；文档追加、排版、样式和写入意图分别规划对应的单一文档工具。真实规划测试确认普通节点文档编辑不再包含 Chrome 步骤。

## 八、节点标题与文档标题不一致

- 问题现象：节点已有明确名称，但 MCP 文档标题仍显示通用“节点文档”。
- 复现条件：历史文档存储标题为空、为“节点文档”或为 `Node Document`。
- 影响范围：文档列表、单篇读取、上下文读取和新建/后续更新。
- 涉及模块：文档目标解析、文档列表/读取 SQL、写入默认标题、stdio 与应用内 MCP。
- 当前状态：已修复。返回有效 `title`：通用标题回退到节点名称，独立文章标题保持不变；同时返回 `storedTitle`、`nodeTitle`、`titleSource` 便于审计。新建文档默认使用节点标题；已有通用标题只在发生真实文档写入时迁移，纯读取不修改数据库。

## 九、编辑权限只有环境级总开关

- 问题现象：`AISTUDY_MCP_ALLOW_EDIT=1` 会开放整套本地 stdio 编辑能力，无法按工具、知识库或节点收窄。
- 复现条件：不同职责 Agent 共用同一个本地 MCP 配置。
- 影响范围：所有知识库、导图与节点文档编辑工具。
- 涉及模块：stdio tools/call 前置校验、应用内 MCP 控制器、`mcp_get_started` 安全状态和接入文档。
- 当前状态：已修复。新增 `AISTUDY_MCP_ALLOWED_EDIT_TOOLS`、`AISTUDY_MCP_ALLOWED_COURSE_IDS`、`AISTUDY_MCP_ALLOWED_NODE_IDS`。总开关仍是必要条件；配置任一范围白名单后，缺目标或超范围请求以 `MCP_EDIT_POLICY_DENIED` 缺省拒绝。`mcp_get_started.safety.editPolicy` 返回实际生效策略。远程 MCP 仍保留设置页权限组、远程工具白名单、token 和 Origin 的独立防线。

## 十、RAG 向量索引状态无法确认

- 问题现象：文档写入结果有快照和哈希，但调用方无法确认当前快照是否已经进入向量索引。
- 复现条件：写入后仅依据 `documentId`、`currentSnapshotId`、`contentHash`、`updatedAt` 推断 RAG 已同步。
- 影响范围：依赖最新内容检索的 Agent、审计流程与知识更新工作流。
- 涉及模块：文档列表/读取/写入/上下文响应、`mcp_get_started` 安全状态、接入文档。
- 当前状态：已消除误判，但未虚构 RAG 功能。仓库当前没有可查询的向量索引实现、向量版本或索引状态表，因此响应明确返回 `ragIndex.supported=false`、`status="not_configured"`、当前快照、`indexedSnapshotId=null`、`synchronized=false`、`verificationAvailable=false`。本次没有新增数据库表或迁移；未来接入真实索引服务后，必须用该服务的版本状态替换此占位事实。

## 架构与性能约束

- 保持 stdio 长会话复用 Node 进程和 MySQL 连接池；单次辅助命令只用于诊断。
- 普通读取保持轻量；全文模式由调用方显式选择，并设置聚合总量上限，避免低内存目标被大子树破坏。
- 写入结果继续返回轻量元数据，不进行写后完整快照回读。
- 节点标题回退使用已有节点数据，不创建新表、不批量改写历史文档。
- 所有目标解析、截断、权限和 RAG 状态均显式返回，不进行静默退化。

## 验证

- `npm run qa:mcp-system-contracts`：覆盖 PowerShell stdin/file 参数、非法 JSON 拒绝、路径/工具名/ID/JSON 保真、规划、权限、标题、RAG 和源实现对齐。
- `npm run qa:mcp-document-template`：确认中国文章排版与数学表达式既有能力没有回退。
- `node scripts/qa/validate-mcp-node-context.mjs`：确认节点上下文契约。
- `npm run qa:mcp-runtime-safety`：确认范围、缓存和运行时安全约束。
- `npx tsc -p tsconfig.electron.json --noEmit`：确认 Electron TypeScript 类型。
- `npm run build`：通过全部项目 QA、TypeScript、Vite 与 Electron 构建。
- `npm run pack`：通过安全目录版打包，便携数据完成暂存/恢复，桌面与开始菜单快捷方式校验通过。
- 最新 `release\win-unpacked\AIstudy.exe` 已真实启动并保持稳定；复查窗口仍为同一进程和句柄，知识库、目录折叠入口及导图/并排/文档/教材模式入口均可被 UI Automation 识别。

## 回滚

代码提交后优先使用 `git revert <本次提交>` 回滚。打包前的便携数据由项目安全打包脚本暂存并恢复；本次不包含数据库结构或业务数据变更，因此不需要数据迁移回滚。
