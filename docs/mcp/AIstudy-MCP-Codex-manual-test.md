# AIstudy MCP Codex 接入人工验收

## 本次需求解决什么问题

确认 Codex 能发现最新版 `aistudy-mcp-access` Skill，能启动长期 stdio MCP 会话，并能通过 `aistudy` 工具读取真实 AIstudy 节点文档。验收默认只读，不以数据库写入测试连接。

## 前置条件

- 源码位于 `F:\XIANGMU\AIstudy-public`。
- Codex Home 位于 `F:\AIAPP\Codex\.codex-home`。
- Node.js 位于 `E:\MorenAnzhuangLujing\Huangjingdajian\Nodejs\node.exe`。
- AIstudy MySQL 数据库可连接，`.runtime` 数据目录存在。
- 项目 Skill 已同步到 `F:\AIAPP\Codex\.codex-home\skills\aistudy-mcp-access`。

## 最少验收步骤

1. 新开 PowerShell，设置当前命令使用 F 盘 Codex Home：

   ```powershell
   $env:CODEX_HOME = "F:\AIAPP\Codex\.codex-home"
   ```

2. 运行：

   ```powershell
   codex mcp list
   ```

   预期看到 `aistudy` 为 `enabled`，并且编辑环境变量保持关闭。命令输出中的环境变量值应被隐藏或脱敏。

3. 新开一个 Codex 任务，输入：

   ```text
   使用 $aistudy-mcp-access。不要使用 shell 或 call-aistudy-mcp.mjs。请通过已注册的 AIstudy MCP 调用一次 mcp_get_started，只返回 MySQL、数据目录和只读状态。
   ```

4. 在同一个新任务中，提供一个真实 `aistudy://node/...` 紧凑引用，要求使用 `read_node_document` 做只读读取，并检查 `complete`。

## 通过标准

- Codex 明确加载 `aistudy-mcp-access` Skill。
- 工具调用来自 MCP server `aistudy`，而不是辅助脚本或 shell。
- `mcp_get_started` 返回 `health.mysql=true` 和 `health.dataRootExists=true`。
- `safety.defaultMode` 为 `read-only`，`safety.editPolicy.enabled=false`。
- 目标节点标题正确，正文读取返回 `complete=true`；如果返回 `complete=false`，Codex 会按 `nextOffset` 或 `requiredNextCall` 继续读取。
- 验收过程中没有写入、覆盖、删除或数据库结构变更。

## 失败标准与反馈证据

以下任一情况均不通过：

- Skill 可见但没有 `aistudy` 工具。
- `aistudy` 已注册但新任务仍无法调用。
- MySQL 或数据目录健康检查失败。
- 连接测试要求开启编辑权限。
- 使用辅助脚本成功，却没有验证 Codex 正式 MCP 路径。
- 文档被截断后仍被当作全文。

反馈时提供：`codex mcp list` 的脱敏结果、Codex 新任务中的工具名与错误文本、目标紧凑引用。禁止提供 token、Cookie、密码、授权头或 Codex 配置原文。

## 回滚

只移除 AIstudy MCP 注册，不影响其他 MCP：

```powershell
$env:CODEX_HOME = "F:\AIAPP\Codex\.codex-home"
codex mcp remove aistudy
```

如需回滚 Skill，恢复同步前保存在 F 盘的 `aistudy-mcp-access` 备份，并新开 Codex 任务。不要删除或覆盖其他 Skill、MCP 或 Codex 配置。

## 当前未覆盖场景

- 本文不以开启编辑权限作为接入验收；编辑应在用户明确授权后按工具、知识库和节点白名单单独验证。
- 远程 HTTP/Tailscale 接入不属于本次本机 stdio 验收范围。
- RAG 当前未配置可验证索引时，只能报告 `not_configured`，不能宣称文档已进入最新向量索引。
