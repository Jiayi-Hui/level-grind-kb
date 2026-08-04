# P0 Architecture — Notes → Idea Book (Tencent Cloud shared runtime)

## Existing Context

The 2026-08-03 governance decision separates product development from data
ingestion approval. Notes and Idea Book may be built and tested with public,
synthetic or properly de-identified fixtures, but production ingestion of real
team Notes/Ideas is frozen until Tiff confirms the permitted data classes,
hosting boundary and AI policy. See
`docs/NOTES_IDEAS_SECURITY_DECISION_2026-08-03.md`.

The repository contains two runtimes: a legacy D1/R2 application and the current EdgeOne runtime. The selected shared production path is TencentDB for PostgreSQL + COS behind authenticated Tencent Cloud API services, with EdgeOne as the public edge layer. Existing D1/R2 and Supabase code is compatibility/reference code, not the target for new shared Notes, Ideas, or mobile data.

P0 therefore defines one Tencent Cloud shared write contract first. Until that contract is wired to production, browser `localStorage` is not allowed to represent shared Notes or Ideas.

## Proposed Shape

```text
uploaded file
  → COS source file + upload status
  → extraction_run (async, retryable)
  → shared research_note + entity links
  → idea_draft + note links
  → PM review state transition
```

## Tencent production stack

- **EdgeOne**: domain, HTTPS, CDN/WAF, and routing.
- **TencentDB for PostgreSQL**: shared relational data, private AskAI history,
  audit records, queue state, and future vector indexes.
- **COS**: Notes, reports, Excel files, images, and immutable source assets.
- **Hong Kong CVM/Lighthouse worker**: authenticated API plus background
  parsing, indexing, and Yahoo Finance refresh jobs. This is the predictable
  first production path; CloudBase is not assumed until regional availability
  and networking are verified.
- **Clerk**: remains the identity provider; Tencent APIs validate the same
  Clerk tokens and preserve the existing `user_id` mapping.

## Data Model

- `entities`: canonical company/sector/asset identity.
- `entity_identifiers`: Wind, Bloomberg, Yahoo, internal identifiers.
- `entity_aliases`: Chinese/English names and common abbreviations.
- `source_files`: COS object key, uploader, template, size, checksum, visibility, soft-delete status.
- `extraction_runs`: parser version, status, progress, error, retry count, started/completed timestamps.
- `research_notes`: shared note body, template type, source metadata, extraction status, version.
- `research_note_entities`: Note-to-entity links.
- `ideas`: owner, thesis, direction, conviction, catalyst, risk, review state, time window, version.
- `idea_note_links`: many-to-many supporting Note links.
- `audit_log`: actor, before/after, operation, version.

Keep raw files immutable and editable extracted records separate. Use soft delete and optimistic version checks.

## Search Contract

1. Normalize aliases and identifiers.
2. Exact identifier/entity match.
3. Full-text / keyword match.
4. Vector retrieval over shared Notes only.
5. Optional DeepSeek reranking/synthesis with citations.

DeepSeek is an answer/synthesis layer, not the source of truth for entity resolution or indexing.

## API / Contract

| Area | Route / Function | Request | Response | Errors |
|---|---|---|---|---|
| Upload | `POST /api/research/files` | multipart file + template + visibility | `sourceFileId`, status, progress | 400/413/415 |
| Transient parse | `POST /api/shared-notes/parse` | authenticated multipart `file`; PDF/DOCX/TXT/MD, max 25 MB | extracted text, pages/paragraphs, parser version, warnings; no persistence | 400/401/413/415/422 |
| Status | `GET /api/research/files/:id` | file id | file + extraction status + retryable flag | 404/403 |
| Retry | `POST /api/research/files/:id/retry` | file id | new extraction run | 409/403 |
| Notes | `GET/POST/PATCH /api/research/notes` | filters or note payload | shared notes + entity links | 400/403/409 |
| Ideas | `GET/POST/PATCH /api/research/ideas` | idea payload + expected version | idea + review state | 400/403/409 |
| Search | `GET /api/research/search?q=...` | query + scope | ranked notes/entities/citations | 400/403 |

## Frontend Flow

- Sidebar: `团队研究 → Notes / Idea Book`.
- Notes page: dropzone, progress list, parser state, filters, semantic search, note detail.
- Idea Book: table/card list with review state, owner, ticker, conviction, linked Notes, and review action.
- AskAI can later open with a scoped Note/Idea set; it is not part of P0's parsing path.

## File-processing boundary

- The browser never imports PDF/DOCX parser libraries and never extracts file
  bodies. It only sends the selected file to the authenticated Notes API and
  renders the returned status and preview.
- Text PDFs use deterministic server-side extraction (`pypdf`, BSD-3-Clause); DOCX uses
  `python-docx`; TXT/Markdown use bounded UTF-8 decoding. None requires an LLM.
- Image-only PDFs return `OCR_REQUIRED` instead of an empty-success response.
  OCR is a separate backend job; an LLM is optional only for later layout
  recovery, table interpretation or structured summarization.
- The transient preview route does not write PostgreSQL or COS. Persistent
  original-file ingestion remains behind the independent production write
  approval gate.

## Security / Privacy

- Shared Notes and Ideas use team ACLs; private AskAI remains private.
- AskAI projects, chats, and messages are keyed by the immutable Clerk `user_id`.
  The same user therefore sees the same private history on desktop web, mobile
  web, and a future mobile app after signing into the same Clerk account.
- Events/Claims, Idea Book records, Notes, AI Capex observations, and their
  source files are team-shared records subject to team ACLs. They must never be
  stored only in browser localStorage.
- Original files live in COS; TencentDB PostgreSQL stores metadata, permissions, job state, and object references.
- Note bodies use application-level AES-256-GCM with server-only key material.
  This P0 does not depend on Tencent KMS; key custody, rotation and recovery are
  release gates rather than browser responsibilities.
- Do not expose service-role keys or licensed raw data to the browser.
- Every mutation records actor, version, and audit entry.
- Names and numbers are not the full sensitivity boundary: thesis, catalyst,
  position direction and source identity remain sensitive after simple entity
  redaction.
- Idea records do not use external AI in the first release. Note records require
  explicit `ai_processing_allowed` and the approved de-identification/provider
  policy before any readable content leaves the service boundary.
- A personal Tencent account is an interim operating constraint only. It does
  not imply permanent team asset ownership and requires MFA, recovery, handover,
  backup restoration and least-privilege evidence before real-data ingestion.

## Migration Invariant

- Keep the same Clerk instance, user IDs, publishable key, and secret key across
  hosting/storage changes so existing sessions and invitations remain valid.
- Add a canonical `clerk_user_id` ownership mapping before migrating records;
  keep email as a compatibility/display field rather than the primary owner key.
- Backfill every existing member and record, run a cross-user read-back check,
  and retain a rollback export before cutover. No member re-invites are allowed
  as a migration shortcut.

## Migration / Compatibility

- Start with TencentDB PostgreSQL schema, COS bucket policies, a small authenticated API service, and EdgeOne routing for the shared production runtime.
- Keep existing Event/Claim/Corpus/Model tables intact.
- Do not dual-write D1, Supabase, and TencentDB. New shared modules must use TencentDB/COS only.
- D1/R2 and Supabase remain legacy compatibility paths until an explicit export, read-back verification, and retirement plan is approved.
- EdgeOne static deployment must call the TencentDB/COS-backed write API and must not claim shared write support from browser state.
