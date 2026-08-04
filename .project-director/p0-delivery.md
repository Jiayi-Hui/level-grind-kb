# P0 preview delivery — Notes + Idea Book

Date: 2026-08-03

## Preview boundary

- Local preview only; no commit, push or deployment was performed.
- `VITE_UI_FIXTURES=true` exposes clearly-labelled public/synthetic fixtures.
- Production reads and writes remain disabled by default.
- Direct API mutations also return `INGESTION_FROZEN` unless the server-side
  `NOTES_INGESTION_ENABLED=true` gate is deliberately enabled after approval.

## Delivered

- Notes and Idea Book as first-class desktop/mobile navigation entries.
- Notes list/detail/editor, sensitivity and AI/search/download policy flags,
  compact file/body workspace, and explicit parse/error/partial/conflict
  states. EdgeOne is JSON-control-only for attachment work; file bytes use a
  short-lived direct-COS PUT and parsing happens in the authenticated backend.
- Idea ticker, direction, review workflow, encrypted thesis, optimistic
  versioning and atomic links to shared Notes.
- PostgreSQL tables for Clerk identity mapping, team roles, Notes, Ideas,
  encrypted Idea sections, links, COS metadata, background jobs and immutable
  audit records.
- Application AES-256-GCM envelope encryption with per-record data keys,
  fresh nonces and AAD binding to team/type/id/key-version.
- Tencent Notes/Ideas API, EdgeOne gateways, health/readiness checks,
  fail-closed configuration and a minimal deployable Docker image.
- Local PostgreSQL Compose environment, repeatable synthetic seed and
  deployment/smoke verification scripts.

## Verification evidence

- full Vinext build: passed on Node 24.14.0;
- EdgeOne fixture build: passed;
- lint: passed;
- repository tests: 43/43 passed;
- local migration + twice-run synthetic seed: 1 Note / 1 Idea / 1 link;
- ciphertext scan: no fixture plaintext found;
- Docker image build + `/ready`: passed;
- browser QA: Notes/Idea navigation, compact list/editor scrolling,
  upload/body-preview workspace, filter, workflow, Note link and
  version-conflict preview passed on desktop and mobile.
- real parser QA in the production-shaped container: searchable 10-page PDF
  and DOCX meeting template both returned extracted text; no browser parser was
  used.

## Release blockers

- TencentDB and SCF trial are available; private COS, SCF function/image
  configuration and the EdgeOne service URL are still pending.
- Tiff has not approved real Notes/Ideas hosting or external AI processing.
- COS direct upload, attachment lifecycle endpoints and persistent encrypted
  parsed-body ingestion are implemented. They remain server-frozen until the
  production bucket/runtime variables and two-user staging test are complete.
  XLSX and scanned-PDF OCR are not part of this slice.
- Before real writes: seed the existing Clerk user mapping, validate two
  existing users can read the same synthetic record, attach backup/rollback
  evidence, and keep the same Clerk instance and invitations.
