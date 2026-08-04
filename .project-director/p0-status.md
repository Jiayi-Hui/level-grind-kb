# P0 Status — 2026-08-03

## Current state

Security/governance hold recorded on 2026-08-03:

- Notes and Idea Book development continues normally using public, synthetic or
  properly de-identified fixtures;
- real team Notes / Ideas must not be uploaded, migrated or seeded until Tiff
  confirms the permitted data classes, hosting boundary and AI policy;
- Tiff tentatively prefers not to use the company's existing internal-server
  path, but has not approved Tencent Cloud, a personal account or external AI;
- Jiayi's personal cloud account is the likely near-term operator constraint
  because she is currently the only available maintainer. It is not treated as
  final asset ownership and adds recovery, handover, MFA and audit gates;
- the detailed decision and risk register is in
  `docs/NOTES_IDEAS_SECURITY_DECISION_2026-08-03.md`.

Foundation slice implemented locally, not committed or deployed:

- the earlier D1/R2 Notes/Ideas draft was discarded after the production storage decision changed;
- TencentDB PostgreSQL + COS is now the selected shared production target; no new shared Notes/Ideas code has been deployed;
- Shared Notes now has a TencentDB/COS service contract with fail-closed
  application AES-256-GCM encryption (no KMS dependency), per-Note
  sensitivity/AI/search/download policy, and
  metadata-only audit records. It remains undeployed until the Tencent service,
  encryption key, allowlist and database migration are configured together;
- static EdgeOne AskAI path now streams DeepSeek/OpenRouter-compatible responses, defaults to internal context/no web, and keeps only `DeepSeek` / `联网` retrieval choices;
- OpenRouter server-side allowlist, internal-data guard, and per-request usage/latency logging scaffolded. No real key is stored locally or in Git.
- project-director PRD, architecture, acceptance, and worker reconnaissance artifacts.
- EdgeOne left navigation and mobile navigation now include a real `Notes` view.
- EdgeOne left navigation and mobile navigation now include a real `Idea Book`
  view with ticker, direction, review status and linked Notes.
- the Notes view supports team list, create, edit, optimistic version checks,
  soft deletion, and explicit unavailable/error states; it never uses browser
  storage as the team authority.
- `services/tencent-notes-api` is a deployable Node container that independently
  verifies Clerk sessions and persists Notes/audit rows to TencentDB PostgreSQL.
- `infra/tencent-postgres/001_notes_p0.sql` defines shared Notes, Ideas,
  Note-Idea links, COS file metadata, background parse states, versioning,
  soft deletion, Clerk identity mapping, team roles and immutable audit rows.
- `002_note_idea_attachments.sql` and the Notes service now implement persistent
  PDF/DOCX/TXT/MD attachments, COS direct upload, checksum validation,
  encrypted extraction, retry, versioning and soft deletion for both Notes and
  Ideas. Shared attachment reads work for every active team member; mutations
  retain owner/manager permission checks.

## Verification

- lint: passed.
- full repository tests: 43/43 passed; focused Notes/Ideas upload and
  deployment subset: 10/10 passed.
- full Vinext build on Node 24.14.0: passed.
- EdgeOne fixtures build: passed.
- local PostgreSQL migration + repeatable synthetic seed: passed.
- Notes API Docker image build: passed; real 10-page PDF and DOCX template
  extraction inside the image: passed.
- desktop and mobile browser visual QA for Notes and Idea Book: passed.

## Not yet complete

- Real-data ingestion approval is not granted. Provisioning a database does not
  by itself remove this release gate.

- TencentDB exists and SCF trial capacity is enabled, but the private COS
  bucket, SCF image/function configuration, `DATABASE_URL`, runtime secrets and
  EdgeOne `NOTES_SERVICE_BASE_URL` are not fully connected yet. Production
  correctly remains frozen until those are configured and two existing Clerk
  users pass shared read-back.
- PDF/DOCX/TXT/Markdown upload, parsing, progress/status, retry and soft delete
  are implemented. XLSX and image-only PDF OCR are not part of this slice.
- Parse jobs and audit records are durable, but parsing currently completes in
  the authenticated backend completion request; a detached worker is a later
  resilience improvement.
- Server-side vector embeddings and hybrid semantic search are not wired.
- OpenRouter model selection UI is intentionally deferred; first release uses an allowlist/presets rather than arbitrary models.
- No deployment or commit has been performed.
