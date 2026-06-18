# Importer Scripts

This folder contains maintenance import scripts for batch or recovery tasks.

Rules:

- Scripts must create the same document snapshot protocol used by the app.
- Scripts must validate target mind-map nodes before writing.
- Scripts must keep binary assets out of document JSON.
- Scripts must run dry-run and QA reports before `--commit`.
- Product UI import remains under `src/renderer/features/importer`.

Current scripts:

- `import-docx-to-node-documents.mjs`: parse a DOCX, clean OCR noise, match content to current mind-map nodes, and write Word document snapshots.
- `audit-docx-import.mjs`: read the same DOCX, compare generated snapshots with MySQL, check sentence coverage, noise leftovers, and formatting consistency.

Typical run:

```bash
npm run import:docx -- --file="path/to/file.docx" --self-check-runs=5
npm run import:docx -- --file="path/to/file.docx" --self-check-runs=5 --commit
npm run audit:docx-import -- --file="path/to/file.docx"
```

The script must keep matching accuracy at or above 95% before `--commit`. It removes page numbers, repeated headers, OCR fragments, table continuation labels, exam-tip blocks, and exercise sections before creating snapshots.
