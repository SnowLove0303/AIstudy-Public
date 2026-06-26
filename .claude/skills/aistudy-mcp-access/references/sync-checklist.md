# AIstudy MCP Skill Sync Checklist

Use this checklist whenever MCP features change.

## Triggering Changes

Update this skill when any of these change:

- Tool IDs, names, descriptions, modes, or schemas.
- Remote permission groups or default access policy.
- Tailscale, HTTP, stdio, token, URL, or environment-variable behavior.
- MCP resources, prompts, or first-use instructions.
- Document write safety rules.
- Chrome port platform IDs or URLs.
- User-facing MCP docs under `docs/mcp`.

## Files To Check

- `.claude/skills/aistudy-mcp-access/SKILL.md`
- `.claude/skills/aistudy-mcp-access/references/index.md`
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
python C:\Users\52882\.codex\skills\.system\skill-creator\scripts\quick_validate.py F:\XIANGMU\AIstudy-public\.claude\skills\aistudy-mcp-access
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
- Does `write_node_document` still refuse accidental overwrite?
- Do human docs and the skill say the same first-use order?
- Does `agents/openai.yaml` still describe the skill accurately?
