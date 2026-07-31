# AIstudy MCP Skill Sync Checklist

Use this checklist whenever MCP features change.

## Triggering Changes

Update this skill when any of these change:

- Tool IDs, names, descriptions, modes, or schemas.
- Remote permission groups or default access policy.
- Tailscale, HTTP, stdio, token, URL, or environment-variable behavior.
- Local stdio transport framing or helper scripts.
- MCP resources, prompts, or first-use instructions.
- Document write safety rules.
- Chrome port platform IDs or URLs.
- User-facing MCP docs under `docs/mcp`.

## Files To Check

- `.claude/skills/aistudy-mcp-access/SKILL.md`
- `.claude/skills/aistudy-mcp-access/references/index.md`
- `.claude/skills/aistudy-mcp-access/references/codex.md`
- `.claude/skills/aistudy-mcp-access/references/claude-code.md`
- `.claude/skills/aistudy-mcp-access/references/connection.md`
- `.claude/skills/aistudy-mcp-access/references/tool-index.md`
- `.claude/skills/aistudy-mcp-access/references/workflows.md`
- `.claude/skills/aistudy-mcp-access/references/sync-checklist.md`
- `.claude/skills/aistudy-mcp-access/agents/openai.yaml`
- `docs/mcp/AIstudy-MCP-access-skill.md`
- `docs/mcp/AIstudy-MCP-quickstart.md`
- `docs/mcp/AIstudy-MCP-module-boundary.md`
- `docs/mcp/AIstudy-MCP-tailscale-access.md`

## Validation

Run:

```powershell
python F:\AIAPP\Codex\.codex-home\skills\.system\skill-creator\scripts\quick_validate.py F:\XIANGMU\AIstudy-public\.claude\skills\aistudy-mcp-access
```

For code changes, also run the project checks that match the change:

```powershell
npm run build
node scripts\qa\validate-error-codes.mjs
```

## Review Questions

- Does `tool-index.md` list every current tool?
- Are edit tools still gated by explicit permission?
- Does `format_node_document` remain style-only and text-preserving?
- Do `write_node_document` and `append_node_document` still apply the same Chinese-article hierarchy, paragraph spacing, two-character indent, and protected URL/path/code rules in both stdio and desktop/HTTP implementations?
- Do Windows paths, UNC paths, tool/field names, underscore identifiers, IDs, compact refs, JSON, switches, and script names round-trip exactly?
- Do bounded document reads return `complete` plus mandatory continuation calls, and does `documentMode: "full"` fail atomically above its cap?
- Does PowerShell documentation prefer `--args-stdin`/`--args-file` for complex JSON?
- Does Codex setup register the MCP through `codex mcp add`, keep the default read-only, verify with a fresh Codex process, and avoid direct TOML edits?
- Does Claude Code setup keep bearer tokens outside the Skill and repository, verify the server with `claude mcp list`/`/mcp`, and avoid one-process-per-call helpers?
- Does `mcp_get_started` expose effective tool/course/node edit allowlists and the honest RAG status?
- Do setup and troubleshooting instructions distinguish saved configuration from the effective policy of a long-running MCP process, require reconnect/restart after permission changes, and verify through the same client session that will write?
- Does `write_node_document` still refuse accidental overwrite?
- Do human docs and the skill say the same first-use order?
- Does `agents/openai.yaml` still describe the skill accurately?
