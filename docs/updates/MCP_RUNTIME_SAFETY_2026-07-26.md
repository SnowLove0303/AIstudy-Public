# MCP 功能与性能风险处置记录

日期：2026-07-26

## 基线与范围

- 基线提交：`e65eab9939e0142c281e75dfde7da789beb24f62`
- 影响范围：外部 stdio MCP、应用内 MCP 控制器、节点文档服务、文档页/教材/信息采集保存调用、MCP skill 与文档、QA。
- 未执行：数据库迁移、表结构调整、真实业务文档写入、应用打包。
- 保留：信息采集模块已有未提交改动，不回滚、不覆盖。

## 风险与处置

| 风险 | 触发条件与影响 | 处置状态 |
| --- | --- | --- |
| 参数缺失后扩大为全库读取 | `read_current_mindmap`、`search_nodes`、`list_node_documents` 缺少 `courseId`；耗时和上下文扩大，可能误读其他知识库 | 已改为硬失败；全库操作必须显式 `scope: "all"` |
| 空目标或模糊目标被自动选择 | `mcp_resolve_target` 未收到参数或知识库名有歧义；后续工具可能操作错误目标 | 已禁止空目标；歧义结果不再自动选主目标 |
| Windows JSON 参数转义失败 | PowerShell/CMD 传 `--args-json` 时参数被 shell 吞掉 | 已增加 `--course-name`、`--node-query`、`--scope`、`--mode` 等直接参数 |
| 一次调用一次启动 | 使用本地辅助脚本连续调用；重复 Node、MCP 初始化和 MySQL 连接 | 标准 MCP 继续使用长期 stdio；辅助脚本新增 `--session`，同一进程复用连接池 |
| 普通读取返回重复正文和完整快照 | `read_node_document` 默认返回 raw/clean/normalized/snapshot 多份内容 | 已拆分 `text`、`snapshot`、`audit` 模式；默认只返回一份清理正文 |
| 节点上下文默认过重 | 默认展开后代并读取正文 | 默认不展开后代，文档默认 summary；正文和子树按需开启 |
| 文档并发覆盖 | MCP、文档页、教材或信息采集基于旧快照保存 | 文档事务内 `SELECT ... FOR UPDATE`，校验 `expectedSnapshotId`；冲突返回 `DOCUMENT_VERSION_CONFLICT` |
| 写入完成后完整回读 | 每次写入再次读取并返回完整快照和多份正文 | MCP 写入改为返回版本、大小、长度、哈希等轻量元数据 |
| 快照重复解析 | 相同 `currentSnapshotId` 被连续读取 | stdio 服务和 Electron 文档服务增加 64 项内存 LRU 快照缓存，快照 ID 变化自动失效 |
| 审计阻塞写入响应 | 数据变更事件文件写入处于同步完成链 | stdio 审计进入串行异步队列；会话关闭前排空 |

## 真实验证

- 使用真实紧凑引用 `aistudy://node/1a5dd446/7ebe2aaf?map=mindmap_7e63` 完成只读解析、上下文和文档读取。
- 空 `mcp_resolve_target`：明确失败。
- 空 `read_current_mindmap`：明确失败；`scope: "all"`：成功读取 10 个知识库摘要。
- `read_node_document(mode=text,maxChars=500)`：输出约 1491 字符；改动前完整读取约 41329 字符。
- 两次只读 `--session` 调用：首个结果约 540 ms，第二个结果约 605 ms，总过程约 612 ms；第二次增量约 65 ms。
- `npm run build`：通过。
- `node scripts/qa/validate-error-codes.mjs`：9 个案例、39 个错误码定义通过。
- skill validator：通过。

## 回滚

- 代码回滚以本记录对应提交为单位执行 `git revert <commit>`，不使用 `git reset --hard`。
- 本次没有数据库结构或真实数据变更，无需数据库回滚。
- 如仅需停用本地辅助会话，可继续使用原有单次 `--tool` / `--ref` 调用；标准 MCP stdio 配置不变。
