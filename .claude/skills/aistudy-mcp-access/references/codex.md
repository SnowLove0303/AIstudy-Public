# Codex Setup And Repair

## Architecture

AIstudy MCP and the Skill are separate layers:

- MCP registration gives Codex the `aistudy` tools.
- The Skill teaches Codex which tool to choose, how to resolve targets, and how to read or write safely.

Both layers must be present. A valid Skill cannot compensate for a missing MCP registration, and an MCP registration does not update a stale Skill.

## Current Windows Layout

Use these paths on the maintained AIstudy development machine:

```text
CODEX_HOME=F:\AIAPP\Codex\.codex-home
AIstudy project=F:\XIANGMU\AIstudy-public
MCP server=F:\XIANGMU\AIstudy-public\scripts\mcp\aistudy-mcp-server.mjs
Runtime data=F:\XIANGMU\AIstudy-public\.runtime
Node.js=E:\MorenAnzhuangLujing\Huangjingdajian\Nodejs\node.exe
```

Do not create Skill copies, caches, or MCP runtime data on C drive.

## Install Or Refresh The Skill

The project copy is the versioned source of truth:

```text
F:\XIANGMU\AIstudy-public\.claude\skills\aistudy-mcp-access
```

The Codex-loaded copy is:

```text
F:\AIAPP\Codex\.codex-home\skills\aistudy-mcp-access
```

Back up the loaded copy to F drive, then copy the complete project Skill folder over it. Compare file hashes after copying. Restart Codex after adding or materially updating a Skill so new sessions load the current instructions.

## Register The Local MCP

Set the F-drive Codex home for the command session, then register the stdio server with editing disabled:

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

Use `codex mcp add` and `codex mcp remove`; do not hand-edit Codex TOML for ordinary registration changes.

## Verify The Real Codex Path

1. Run `codex mcp list` and confirm `aistudy` is enabled.
2. Start a fresh Codex process or task so it reloads MCP servers and Skills.
3. Call `mcp_get_started` once.
4. Confirm:
   - `health.mysql: true`
   - `health.dataRootExists: true`
   - `safety.defaultMode: read-only`
   - `safety.editPolicy.enabled: false`
5. Perform one targeted read using a real compact `aistudy://node/...` ref. Do not use an intentional database write as a connection test.

Codex keeps the stdio server alive for the task. Do not wrap each tool call in a new `call-aistudy-mcp.mjs` process; that helper is for diagnostics and scripted batches.

## Failure Routing

- Skill appears but no `aistudy` tools: MCP is not registered or the task predates the registration. Check `codex mcp list`, then start a fresh task.
- MCP is registered but calls fail immediately: verify the Node path, server script, runtime data path, and MySQL health.
- Calls work but target selection or document behavior is wrong: compare the loaded Skill against the project source and refresh stale files.
- A helper call works but Codex does not: test from a fresh Codex process; helper success proves the server, not Codex registration.
- Editing is denied: this is the safe default. Do not enable editing merely to prove connectivity.

## Rollback

Remove only the AIstudy registration:

```powershell
$env:CODEX_HOME = "F:\AIAPP\Codex\.codex-home"
codex mcp remove aistudy
```

Restore the backed-up global Skill folder if the Skill refresh must be rolled back. Never delete or replace unrelated Codex MCP servers or Skills.
