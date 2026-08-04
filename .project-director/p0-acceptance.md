# P0 Acceptance — Shared Notes and Idea Book

- [x] Sidebar exposes Team Research → Notes and Idea Book.
- [x] Analysts can initialise a supported-file upload without page freeze; the
  file bytes go directly from browser to COS, never through EdgeOne.
- [x] PDF/DOCX/TXT/Markdown extraction runs only in the authenticated backend;
  the production client bundle contains no document parser.
- [x] Searchable PDF and DOCX fixtures produce real body text; image-only PDF
  returns `OCR_REQUIRED`, and encrypted/corrupt/oversized files fail explicitly.
- [x] Upload progress and parser status are visible after attachment init,
  direct COS upload, and server-side completion.
- [x] Original files survive parse failures and can be retried.
- [x] Attachment init, complete, list/status, retry and soft delete are
  authenticated JSON control routes; missing COS attachment service fails
  explicitly and never pretends an upload succeeded.
- [ ] Notes are server-persisted and visible to another authorized user.
- [ ] Search resolves Chinese name, English name, aliases, Wind/Bloomberg/Yahoo ticker, and semantic phrasing.
- [ ] Search results show source file, uploader, date, and entity match.
- [x] Idea draft can be created and linked to one or more Notes.
- [x] PM review transition is permission checked and audited.
- [x] Optimistic version conflict is surfaced instead of silently overwriting.
- [x] Private AskAI data is excluded from shared Notes/Idea retrieval.
- [x] Real Notes/Ideas ingestion remains server-disabled until Tiff's hosting,
  data-class and AI-processing approval is recorded.
- [ ] Public/internal/confidential/restricted policy is enforced consistently
  across list, detail, search, download and AI routes.
- [x] Ideas never enter external AI in the first release; Notes require explicit
  per-record permission plus the approved de-identification policy.
- [x] Application AES-256-GCM encryption is configured through server-side key
  material only; no KMS is required for this P0 release.
- [ ] If production remains in Jiayi's personal cloud account, MFA, recovery,
  handover, backup restore, encryption-key custody/rotation and least-privilege
  evidence are complete.
- [x] Loading, empty, partial, failed, retry, and unauthorized states are tested.
- [x] Lint, typecheck, build, and focused route tests pass.
