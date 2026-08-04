# P0 Plan — Shared Notes First

- [x] Inspect current full-app and EdgeOne runtimes.
- [x] Confirm P0 scope and non-goals.
- [x] Define entity, source file, extraction, Note, Idea, and audit contracts.
- [x] Add TencentDB PostgreSQL/COS contract without dual-write ambiguity.
- [x] Add authenticated EdgeOne Notes gateway and deployable TencentDB Notes API service.
- [ ] Add shared upload/status/retry routes using COS + TencentDB behind EdgeOne.
- [ ] Add durable TencentDB background parsing queue record and retry state; worker execution remains the next release slice.
- [ ] Add background entity normalization and hybrid search index; do not load weights in the browser.
- [x] Add Notes UI with loading, empty, edit, conflict, soft-delete, and unavailable states.
- [ ] Provision TencentDB/API runtime, apply migration, and complete two-user cross-user read-back verification.
- [ ] Move static AskAI project/chat/message persistence from browser localStorage to the authenticated server API, keyed by Clerk `user_id`, so the same user sees history across desktop and mobile.
- [ ] Add streaming DeepSeek responses with default no-web mode and an explicit web toggle.
- [ ] Add OpenRouter model allowlist and per-request usage/latency logging.
- [ ] Keep Idea schema/API compatible, but defer third-model Idea processing and full Idea UI until Notes is accepted.
- [ ] Add focused tests for cross-user visibility, status transitions, search, and optimistic conflicts.
- [x] Record the interim Notes/Ideas security boundary and stakeholder signal.
- [ ] Add a production ingestion feature flag that defaults to disabled and
  cannot be enabled without an explicit server-side setting.
- [ ] Keep production upload frozen by default; preview uses public/synthetic
  fixtures only until the owner enables ingestion server-side.
- [ ] Replace the earlier KMS assumption with application AES-256-GCM key
  configuration, rotation and recovery tests.
- [ ] Add public/internal/confidential/restricted classification and enforce
  per-record AI/search/download policy in every Notes/Ideas route.
- [ ] Document personal-account recovery, handover and backup restoration before
  provisioning or enabling real-data ingestion.
- [ ] Run lint/typecheck/build and browser checks.
- [ ] Write delivery evidence and explicitly defer P1 Tracker/P2 Validation.

## Worker allocation

- GPT-5.6-sol: architecture, scope, judgment, acceptance, final QA.
- GPT-5.6-terra / Luna-equivalent workers: reconnaissance, schema scanning, extraction, mechanical edits, repetitive tests.
