# Terra QA checkpoint — 2026-08-03

## QA evidence completed

- Focused P0 contract suite: **8/8 passed**:
  - shared Notes / Idea Book UI contract;
  - Clerk-authenticated Tencent-only gateway;
  - AES-256-GCM envelope and AAD binding;
  - no plaintext research body in audit data;
  - member-directory permission contract;
  - P0 no-fallback / frozen-ingestion contract.
- `npm run lint`: **passed**.
- `npm run edgeone-demo:build`: **passed**. It published the portable Claim
  ledger (45 Claims / 88 mappings) and AI Capex snapshot (75 campuses) before
  building the EdgeOne client bundle.
- The Notes service fails closed if the AES master key cannot be loaded. Its
  direct service routes now reject Note/Idea create, edit, delete and
  Note-Idea link mutations while `NOTES_INGESTION_ENABLED` is not `true`.
- The Dockerfile now copies `crypto-envelope.mjs`; the former module-copy
  blocker is resolved.

## Final convergence evidence

- Full `npm run build` passed under the bundled Node **24.14.0** runtime.
- Full repository test suite: **38/38 passed**, including a real public PDF
  text extraction case and a synthetic DOCX paragraph extraction case.
- Docker image `level-grind-notes-api:preview` built successfully from the
  dedicated two-dependency service package and reached `/ready` against the
  local PostgreSQL container.
- Local PostgreSQL migration succeeded. The explicit synthetic seed is
  repeatable: after two runs it contained one Note, one Idea and one active
  Note-Idea link. Plaintext fixture phrases were absent from ciphertext fields.
- Browser QA passed for Notes and Idea Book navigation, compact independently
  scrolling list/editor panes, Notes file/body preview, filtering, editing,
  status/direction controls, linked Notes, version-conflict preview and the
  explicit “公开/合成演示数据 · 不会保存” boundary.
- UI and API now agree on Idea status, ticker, direction, optimistic version,
  detail loading and Note links. Update/delete requests use record-specific
  routes rather than the collection endpoint.

The Notes payload remains aligned: title, body, source kind, sensitivity and
the three consent flags normalize correctly. Its freeze is enforced at both
the UI and direct service route layers.

## Remaining release gates

1. Provision TencentDB/COS only after the documented backup, rollback and
   Clerk mapping seed are reviewed. Confirm legacy invitee roles map into
   `research_team_memberships` before any write switch is enabled.
2. Run the two-existing-Clerk-user signed-in staging smoke with public or
   synthetic data. Do not create a second identity/invitation authority.
3. Keep production `NOTES_INGESTION_ENABLED=false` until Tiff’s explicit
   approval; a preview is not a persistence claim.
4. Browser-local PDF/DOCX/TXT/Markdown parsing is verified, but complete COS
   object upload and persistent parser-job integration before claiming team
   upload is available. Current extraction never leaves the active browser.
