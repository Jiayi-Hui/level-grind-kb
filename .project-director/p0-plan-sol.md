# Level Grind P0 — Shared Notes and Reviewed Idea Book

Date: 2026-08-02  
Mode: Project Director Build planning  
Status: implementation plan; no product code changed

## 1. Objective

Move Level Grind from a file-oriented knowledge surface to the first usable
slice of an idea-tracking research database:

1. analysts can upload shared research Notes without losing work or waiting on
   a blocking parser;
2. files are parsed into searchable Notes with explicit processing states;
3. company names, aliases, and tickers resolve to canonical securities;
4. search combines exact entity lookup, lexical retrieval, and semantic
   retrieval;
5. reviewed Ideas have a lifecycle and can link back to the Notes that support,
   contradict, originate, or update them.

The P0 user journey is:

```text
Analyst uploads Note
  -> file is durably stored and immediately visible as Processing
  -> background parser creates text/chunks/entity candidates
  -> analyst reviews failed or uncertain metadata
  -> team can find the Note by Chinese name, English name, ticker, keyword, or meaning
  -> authorized user creates/submits an Idea and links relevant Notes
  -> PM/manager approves or rejects the Idea with review history
```

## 2. Current Architecture Findings

- Production `level-grind.com` is the portable Tencent EdgeOne Vite build under
  `deploy/edgeone-demo`, not the full `app/research-workspace.tsx` D1/R2 app.
- The production navigation currently exposes Personal Knowledge, Event DB,
  AI Capex, AskAI, and Settings. Personal Knowledge and AskAI histories are
  browser-local; they are not team Notes.
- The older `/api/documents` route accepts files up to 25 MB into R2 but does
  not parse them. The older `/api/corpus` route parses PDF reports, is
  admin-only, and is tied to the D1/R2 runtime.
- General knowledge search is currently SQL `LIKE` or browser `includes`.
  Only Event Claim search has semantic retrieval, using browser-loaded
  `bge-small-zh-v1.5` q8 vectors.
- Supabase already holds the shared relational pilot and the repo already has
  Clerk-authenticated EdgeOne server-function patterns. Only shared Claim
  overlays and privacy-minimal AI usage are connected end-to-end today.
- `stored_objects`, `knowledge_items`, `background_jobs`, `audit_log`, and
  `vector_documents` are useful foundations, but P0 needs explicit Notes,
  securities/aliases, Idea review, Note-Idea links, parse artifacts, and an
  actual embedding column.

## 3. Scope

### In scope

- Team-shared Notes navigation and list/detail/upload views.
- Direct-to-object-store upload with progress, integrity metadata, and durable
  upload completion before parsing starts.
- PDF, DOCX, XLSX, PPTX, TXT, MD, CSV, and common image acceptance; each format
  may have a different extraction quality state.
- Asynchronous parse/index state machine with retry and honest partial/failure
  states.
- Canonical security/entity registry plus Chinese/English/ticker aliases.
- Hybrid search: exact entity/ticker first, lexical/FTS second, vector third,
  optional model reranking last.
- Idea Book list/detail/create/edit and review lifecycle.
- Explicit many-to-many Idea–Note links with relation type.
- Clerk-derived identity, team ACL, optimistic versioning, soft delete, and
  immutable audit history for shared mutations.
- Desktop and mobile usable states: loading, uploading, processing, partial,
  failed/retry, empty, success, unauthorized, and conflict.

### Non-goals for this release

- Tracker library, Weekly Change, price/financial refresh, or model updates.
- Automatic Idea-to-Tracker creation.
- Idea validation against Events, AI Capex, reports, or the public web.
- Support/contradiction verdict generation, investment recommendations,
  factor analysis, risk analysis, event studies, or backtests.
- Universal high-fidelity interpretation of every proprietary spreadsheet.
- Production ingestion of confidential team Notes until the provider, region,
  retention, backup, and access policy is approved. The existing Singapore
  pilot remains public/sanitized only.

## 4. Information Architecture

P0 adds two first-class shared surfaces without adding Tracker/P2 placeholders:

```text
个人知识库
Notes
Idea Book
事件库
AI Capex
AskAI
模型工作台
设置
```

`Notes` is shared source evidence. `Idea Book` is the reviewed judgment layer.
Personal Knowledge remains private user material and must not be silently
merged into Notes.

## 5. Data Model

Add a new migration after `002_weekend_shared_state.sql`.

### Files and parsing

#### `research_files`

- `id uuid primary key`
- `object_id uuid references stored_objects`
- `team_id text`
- `uploaded_by uuid references app_users`
- `document_type text` — meeting-note, investment-memo, weekly-memo,
  research-report, tracker-source, other
- `processing_status text` — uploaded, queued, parsing, partial, parsed, failed
- `parser_version text`
- `detected_media_type text`
- `page_or_sheet_count integer`
- `last_error_code text`, `last_error_message text`
- `attempts integer`, `version integer`
- timestamps and soft-delete fields

#### `file_extractions`

- one versioned extraction per file/parser version;
- `plain_text`, `markdown`, `structured_fields jsonb`, `warnings jsonb`;
- `content_hash`, `created_at`.

The original binary is immutable. Retrying extraction creates or replaces a
derived extraction version; it does not overwrite the uploaded source.

### Notes

#### `notes`

- `id uuid primary key`
- `file_id uuid references research_files` (nullable for manual Notes)
- `team_id`, `title`, `note_type`, `body_markdown`
- `author_user_id`, `meeting_or_source_date`, `source_kind`
- `publish_status` — draft, shared
- `extraction_status` — processing, partial, ready, failed
- `version`, timestamps, soft-delete fields

#### `note_chunks`

- `note_id`, `chunk_index`, `content`, `content_hash`
- `search_vector tsvector`
- `embedding vector(512)` for the initial reviewed
  `bge-small-zh-v1.5` embedding contract
- `embedding_model`, `metadata jsonb`

The embedding size/model must be versioned. Changing the model requires a
background reindex job, not an in-place semantic change.

### Canonical entities and ticker resolution

#### `securities`

- canonical `id`, company legal/display names, exchange/MIC, currency, country,
  primary ticker, active status.

#### `security_identifiers`

- `security_id`, `scheme` (Bloomberg, Wind, Yahoo, local, ISIN, etc.), `value`,
  `is_primary`; unique by scheme/value.

#### `security_aliases`

- `security_id`, normalized alias, original alias, language, alias type,
  priority, source, review status.

#### `note_security_mentions`

- `note_id`, `security_id`, raw mention, location/evidence, confidence,
  resolution method, review status.

Exact identifiers and reviewed aliases always outrank semantic similarity.
Uncertain matches remain candidates and never silently relabel a Note.

### Idea Book and review

#### `ideas`

- `id`, `team_id`, `title`, `primary_security_id`
- `direction` — long, short, pair, watch
- `thesis`, `consensus_gap`, `catalysts`, `risks`, `invalidation_conditions`
- `owner_user_id`
- `review_status` — draft, pending_review, approved, rejected, archived
- `reviewed_by`, `reviewed_at`, `review_comment`
- `version`, timestamps, soft-delete fields

P0 does not add performance, conviction history, target price, or Tracker
snapshots unless already present in an uploaded template; those belong to P1.

#### `idea_note_links`

- `idea_id`, `note_id`
- `relation` — originates, supports, contradicts, updates, context
- `created_by`, `created_at`
- composite unique key on idea/note/relation

#### `idea_review_history`

- immutable status transition records: from/to status, actor, comment,
  timestamp, and Idea version.

All shared mutations also append to the existing `audit_log`.

## 6. API and Frontend Contract

All APIs require a valid Clerk session and active team membership. Browser code
never receives Supabase service-role or object-store secrets.

| Area | Route | Contract | Key errors/states |
|---|---|---|---|
| Upload init | `POST /api/note-files/init` | file name/type/size/hash, document type -> file id + signed/direct upload instruction | 400 invalid, 413 too large, 415 unsupported, 401/403 |
| Upload complete | `POST /api/note-files/:id/complete` | uploaded checksum/version -> queued file record | 409 duplicate/conflict, 422 checksum mismatch |
| Upload status | `GET /api/note-files/:id` | processing state, progress stage, warnings, retryability, resulting note id | honest uploaded/queued/parsing/partial/parsed/failed |
| Retry | `POST /api/note-files/:id/retry` | expected version -> queued job | 409 conflict, 422 non-retryable |
| Notes list | `GET /api/notes` | cursor, q, entity, type, author, date, status -> ACL-filtered results | empty and partial states |
| Note detail | `GET /api/notes/:id` | Note, file, extraction warning, entities, linked Ideas, version | 404/403 |
| Note edit | `PATCH /api/notes/:id` | editable metadata/body + expected version | 409 stale edit |
| Hybrid search | `POST /api/search/notes` | query + filters + cursor -> ranked Notes with match reasons | exact/entity/lexical/semantic score components |
| Entity candidate review | `PATCH /api/notes/:id/entities` | accept/reject/change candidate + expected version | 409 conflict |
| Ideas list/detail | `GET /api/ideas`, `GET /api/ideas/:id` | filters + Idea, links, review history | 404/403 |
| Idea mutation | `POST /api/ideas`, `PATCH /api/ideas/:id` | fields + expected version | field validation, 409 conflict |
| Idea review | `POST /api/ideas/:id/review` | action submit/approve/reject/archive + comment + expected version | invalid transition, 403, 409 |
| Idea–Note link | `POST/DELETE /api/ideas/:id/notes` | note id + relation | duplicate, 403, 404 |

### Search ranking contract

1. normalize query and resolve exact ticker/security aliases;
2. retrieve exact entity-linked Notes;
3. retrieve PostgreSQL full-text matches;
4. retrieve pgvector nearest chunks in the team namespace;
5. blend scores with exact matches dominant and return `matchReasons`;
6. optionally use DeepSeek only to rerank a small candidate set or formulate an
   answer. DeepSeek is not the index and search still works when it is down.

The first result set must make the reason visible: matched ticker, matched
alias, keyword excerpt, or semantic excerpt.

### Upload and parsing contract

- Upload bytes directly to object storage; do not route large binaries through
  the EdgeOne function body.
- The browser marks success only after server-side completion/checksum
  confirmation.
- Parsing is performed by a durable worker that consumes `background_jobs`.
  Closing the browser must not cancel parsing.
- Parser stages are `detect -> extract -> normalize -> resolve entities ->
  chunk -> embed -> ready`.
- A parser can return `partial` with usable text plus warnings. A failed parse
  never removes the original file.
- Extraction adapters are format-specific and versioned. Images require OCR;
  scanned PDFs may be partial until OCR is available.

## 7. Recommended Implementation Files

Exact names may be refined to existing patterns, but keep production changes
inside the EdgeOne path and shared server contracts:

### Add

- `infra/shared-data/postgres/003_notes_ideas_p0.sql`
- `public/cloud-functions/api/note-files.js`
- `public/cloud-functions/api/notes.js`
- `public/cloud-functions/api/note-search.js`
- `public/cloud-functions/api/ideas.js`
- `public/cloud-functions/api/idea-reviews.js`
- `public/cloud-functions/api/_shared-research.js`
- `app/team-notes.tsx`
- `app/idea-book.tsx`
- `lib/research-entities.ts`
- `lib/hybrid-note-search.ts`
- `scripts/worker/process-note-jobs.mjs` or the equivalent deployable worker
- `tests/notes-api.test.mjs`
- `tests/idea-lifecycle.test.mjs`
- `tests/note-search.test.mjs`
- `tests/note-upload-state.test.mjs`

### Modify

- `deploy/edgeone-demo/src/main.tsx` — add Notes and Idea Book views/navigation.
- `deploy/edgeone-demo/src/mirror.css` and `app/globals.css` — responsive upload,
  list/detail, status, search, and review states.
- `package.json` — migration/worker/index verification commands.
- `infra/shared-data/README.md` — P0 storage, worker, privacy, and restore
  boundary.
- `.project-director/prd.md`, `architecture.md`, `acceptance.md`, `plan.md`,
  `qa-report.md`, and `delivery.md` during implementation.

Do not build P0 only in `app/research-workspace.tsx`; that surface is not the
current Tencent production entry point.

## 8. Implementation Order and Gates

1. **Contract gate** — finalize migration, roles, lifecycle transitions,
   object-store adapter, size limits, and P0 data/privacy boundary.
2. **Persistence first** — migration, authenticated shared API helper,
   optimistic writes, audit, soft delete, and object upload handshake.
3. **Upload vertical slice** — one small PDF/DOCX can upload, immediately appear
   as Processing, finish or fail honestly, and remain visible across two users.
4. **Parser worker** — format adapters, extraction versions, retry, partial
   status, and idempotent job dedupe.
5. **Entity foundation** — securities, identifiers, aliases, candidate review,
   and a small reviewed ticker seed.
6. **Hybrid search** — FTS + pgvector + exact aliases, match reasons, permission
   filters, and unavailable-embedding fallback.
7. **Idea lifecycle** — create/edit/submit/review/archive and Note relations.
8. **Integrated UI** — Notes and Idea Book desktop/mobile flows, upload progress,
   filters, detail/review history, and accessible error recovery.
9. **Release-candidate QA** — cross-user persistence, private/shared boundaries,
   duplicate upload, parser crash/retry, stale update conflict, malformed files,
   search quality cases, build/lint/tests, and browser checks.

Do not start Tracker or validation work before the P0 acceptance gate passes.

## 9. Acceptance Criteria

- AC-1: Notes and Idea Book appear in the production desktop and mobile
  navigation and switch the main workspace without leaving the app.
- AC-2: Two authorized users see the same uploaded team Note after refresh;
  redeploying the frontend does not remove it.
- AC-3: Upload shows byte progress, returns without waiting for parsing, and
  exposes uploaded/queued/parsing/partial/parsed/failed states with retry where
  safe.
- AC-4: A parser crash or browser close does not lose the original file or leave
  a silently stuck success state.
- AC-5: PDF, DOCX, XLSX, PPTX, TXT, MD, and CSV fixtures either parse or return an
  explicit supported-partial/failure reason; common images enter an OCR state
  instead of pretending to contain extracted text.
- AC-6: Searching a reviewed test company by Chinese name, English name,
  Bloomberg/Wind/local ticker alias, and a related semantic phrase retrieves
  the expected Note with a visible match reason.
- AC-7: Exact ticker/entity matches outrank semantic lookalikes; unresolved
  entities are shown as candidates and do not corrupt canonical metadata.
- AC-8: DeepSeek or embedding-provider failure leaves exact/lexical search
  usable and is visible to the user.
- AC-9: An Idea can move only through valid lifecycle transitions; every review
  action records actor, time, comment, and prior/new state.
- AC-10: An Idea links to multiple Notes and a Note links to multiple Ideas with
  relation labels; link removal does not delete either object.
- AC-11: Non-members cannot read team files or metadata; members cannot bypass
  server ACLs with a guessed id; no service secret is present in client bundles.
- AC-12: Shared edits use optimistic versions, soft deletion, and audit entries;
  stale edits return 409 rather than overwrite newer work.
- AC-13: Loading, empty, error, partial, unauthorized, conflict, disabled, and
  mobile states are exercised in browser QA.
- AC-14: Migration rehearsal, lint, focused tests, production build, and a
  dated export/restore check pass before production deployment.

## 10. Risks and Decisions

1. **Storage provider and confidentiality** — the current Supabase Singapore
   pilot is approved only for public/sanitized data. Before real team Notes,
   approve Supabase Storage vs Tencent COS/Blob, region, backup, retention, and
   deletion. Code should hide the provider behind a server upload contract.
2. **No durable worker exists yet** — EdgeOne page functions alone are not an
   assumed PDF/Office/OCR worker. Select and deploy a durable worker before
   describing parsing as asynchronous. Until then, upload can be released only
   as storage plus queued/pending, not fake parsing completion.
3. **Format breadth vs quality** — file acceptance and successful extraction
   are different. Preserve binaries, expose warnings, and measure extraction
   coverage per format.
4. **Vector model placement** — the existing browser BGE model is useful for a
   demo but cannot own a shared index. Generate embeddings in the worker and
   store versioned vectors in pgvector; use browser vectors only as a degraded
   local fallback if explicitly labelled.
5. **Ticker ambiguity** — local codes can collide across exchanges; store
   exchange-qualified identifiers and require review below a confidence
   threshold.
6. **Schema overlap** — do not extend legacy D1 `documents` and Supabase
   `knowledge_items` independently. P0 production writes to the shared
   relational contract; legacy routes remain migration sources only.
7. **Review authority** — default proposal: Analyst/member may create Draft and
   submit; PM/GEM PM/Admin/Owner may approve/reject/archive. Confirm the exact
   mapping before enforcing it in production.
8. **Release discipline** — deliver this as one P0 release candidate after the
   vertical slice and acceptance suite pass, rather than deploying each route
   or UI panel separately.

## 11. First Build Slice

The smallest trustworthy first slice is not the whole P0. It is:

```text
one authenticated team user
  -> uploads one PDF or DOCX through a direct object-store handshake
  -> sees Processing immediately
  -> durable worker parses and indexes it
  -> second authenticated team user finds it by ticker and semantic phrase
  -> both users see the same Note after refresh
```

Only after this slice passes should Idea review and general format breadth be
built on top of it.
