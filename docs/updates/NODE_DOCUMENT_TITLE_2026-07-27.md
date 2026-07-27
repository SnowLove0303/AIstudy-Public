# Node document title

Date: 2026-07-27

## Baseline

Node documents were already bound by `courseId + mindMapId + nodeId`, but the editable page had no visible title. The selected node name appeared only in the bottom status strip and DOCX file metadata/file name.

## Change

- The current mind-map node name is rendered as a restrained heading above the node document body.
- The heading and editable canvas have separate layout boundaries, so the title remains visible while the document body scrolls.
- The node name remains the only source of truth. No title element is copied into stored document snapshots and no historical document is rewritten.
- DOCX export prepends the current node name as the visible first-level heading.
- Empty or whitespace-only node names use `未命名节点` consistently in save metadata, UI, status, importer targets, and export.

## Impact and data safety

- Renderer-only title presentation plus read-only DOCX projection.
- No schema, table, field, snapshot, or data migration.
- Existing documents gain the heading immediately; renaming a node updates the heading on the next render.
- Document save/version/concurrency behavior is unchanged.

## Verification

- `npm run qa:node-document-title`
- `npm run build`
- Real packaged-app verification: open a real knowledge base, switch to split mode, confirm the selected node name appears above its document, navigate to another node, and confirm the heading follows without altering the body.

## Rollback

Revert the feature commit. Stored node documents require no rollback because their snapshots are unchanged.
