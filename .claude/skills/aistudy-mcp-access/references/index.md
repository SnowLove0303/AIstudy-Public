# AIstudy MCP Skill Index

This skill is the canonical agent-facing entry for AIstudy MCP access.

## Files

- `../SKILL.md`: trigger metadata, core safety rules, and reference routing.
- `connection.md`: connection shapes and config snippets.
- `tool-index.md`: current tool groups, edit permissions, and safety semantics.
- `workflows.md`: standard task sequences.
- `sync-checklist.md`: required maintenance checklist after MCP changes.
- `../agents/openai.yaml`: UI metadata for skill discovery.

## Source Of Truth

- In-app MCP controller: `electron/mcp/controller.ts`
- Remote HTTP/Tailscale access: `electron/mcp/remoteAccess.ts`
- Main-process tool implementations: `electron/main.ts`
- External stdio MCP server: `scripts/mcp/aistudy-mcp-server.mjs`
- User docs: `docs/mcp/*.md`

## Update Order

1. Update runtime code and schemas.
2. Update `tool-index.md` and `workflows.md`.
3. Update `SKILL.md` only if trigger conditions, core rules, or reference routing changed.
4. Update `docs/mcp/*.md` so human docs match this skill.
5. Regenerate or review `agents/openai.yaml` if the skill purpose changed.
6. Run skill validation and project verification.
