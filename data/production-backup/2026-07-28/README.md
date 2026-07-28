# Production backup

- Source: https://level-grind-workspace.dingjingbo3747.chatgpt.site
- Exported: 2026-07-28T00:13:37.112Z
- D1: 25 tables / 6555 rows
- R2: 45 objects / 82033505 bytes

Folders:

- `d1/tables/`: every production application table as JSON.
- `r2/objects/`: every production object exactly as stored; original keys and
  metadata are in `manifest.json`.
- `reports/pdfs/`: 30 directly openable PDFs reconstructed from the R2 parts.
- `reports/page-text/`: per-report, per-page searchable text.
- `reports/manifest.json`: PDF and page-text sizes and SHA-256 checksums.

From the repository root, run
`npm run backup:verify -- data/production-backup/2026-07-28` to verify every
raw object and every materialized report artifact.
