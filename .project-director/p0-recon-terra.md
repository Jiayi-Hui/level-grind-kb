# P0 Recon — Notes, Idea Book, Tracker (2026-08-02)

## Scope

Read-only reconnaissance for the next Level Grind release batch:

1. shared Notes upload with reliable status;
2. company / ticker-aware and semantic retrieval;
3. Idea Book review state and links back to Notes;
4. leave a clean path for a later Tracker library.

No application code, migration, deployment configuration, or production data was changed by this reconnaissance.

## Current architecture

| Layer | Current implementation | Evidence |
|---|---|---|
| Main application | Next 16 / React 19 via Vinext, Cloudflare Worker entry | `app/`, `worker/index.ts`, `vite.config.ts` |
| Primary application storage | Cloudflare D1 (`DB`) for relational records; R2 (`FILES`) for attachments and report bytes | `db/index.ts`, `worker/index.ts`, `app/api/documents/route.ts` |
| Authentication | Clerk server verification, then active `team_members` row and owner/admin/member role resolution | `lib/access.ts` |
| AskAI | DeepSeek-compatible server route, optional Tavily web search, D1-persisted per-user projects/chats/messages | `app/api/ask/route.ts`, `lib/research.ts` |
| Event DB | D1 research events, claims, notices and relation table; static seed/export pipeline exists too | `drizzle/0009_research_events.sql`, `drizzle/0010_research_claims_notices.sql`, `app/event-research.tsx` |
| Current semantic retrieval | Browser-local Hugging Face `bge-small-zh-v1.5` q8, only for Event Claims | `lib/local-claim-vector-search.ts` |
| Tencent continuity build | Separate static Vite app, with its own navigation and EdgeOne functions | `deploy/edgeone-demo/src/main.tsx`, `public/cloud-functions/api/` |
| Shared-data pilot | Supabase PostgreSQL contract and EdgeOne server-function adapters for selected shared state | `infra/shared-data/README.md`, `public/cloud-functions/api/shared-claims.js` |

### Selected production direction

Supabase is now treated as a temporary pilot only. New shared Notes, Ideas,
files, and jobs must target TencentDB PostgreSQL + COS behind an authenticated
Tencent Cloud API service. Do not add dual writes.

### Important deployment constraint

There are now two materially different application surfaces:

- `app/research-workspace.tsx` is the full Vinext/D1/R2 application. It contains the usable knowledge capture, report library, model workbench, AskAI history and admin/member UI.
- `deploy/edgeone-demo/src/main.tsx` is a static continuity/demo app. It has only Personal Knowledge, Event DB, AI Capex, AskAI and Settings; Report Library and Model Workbench are deliberately disabled/"待上线". Its current data and API contracts are not the same as the full application.

P0 should pick **one production runtime contract before adding Notes/Ideas/Trackers**. Building P0 independently into both surfaces would duplicate storage, authorization and retrieval work and risks a user seeing different data at the canonical URL.

## Existing reusable capability

### 1. Notes / personal-team material

**Already implemented**

- `documents` stores title, body, author, project, importance, visibility, source URL, file metadata and timestamps.
- `document_context` stores scope, source system, topics, event date and confidence.
- `POST /api/documents` accepts a free-text note, URL, or arbitrary file; stores file bytes in R2 and metadata in D1.
- `PATCH /api/documents` and `DELETE /api/documents` enforce author-or-owner/admin permission. Existing deletion physically removes the D1 rows and R2 file.
- UI has a material composer and attached-file picker in `app/research-workspace.tsx`; `DocumentDesk` is the best UI component to evolve into a Notes Inbox.
- Team sharing is already enforced at the read query: a team document is visible to all active members, private documents only to the author.
- A duplicate merge rule combines equivalent text notes added to personal and team scopes; it avoids double rendering in the current personal knowledge list.

**Current gap vs P0**

- The generic `documents` schema has no canonical ticker/company relation, template type, parser state, extraction JSON, review status, version, soft-delete, or structured link to an Idea.
- Attachment upload is a single request and has a hard 25 MB limit. The UI only indicates generic save state; it has no byte-level upload progress, background parsing state, retry, or parse-error state.
- Files are accepted regardless of type but are not parsed into searchable text. A DOCX/XLSX/image attachment therefore remains only a downloadable object, not a usable shared Note.
- No task queue/background worker exists for file parsing, OCR, ticker/entity extraction, embedding/index refresh, or retry.
- DELETE is physical deletion, contrary to the desired future audit/soft-delete behavior.

### 2. Report ingest and page search

**Already implemented**

- Separate `corpus_documents` and `corpus_chunks` store report metadata and PDF page text.
- PDF importer writes original bytes to R2, parses pages using `unpdf`, and stores page chunks in D1: `lib/corpus-import.ts`.
- For large known report batches, bootstrap routes split file and page text writes: `app/api/corpus/bootstrap/*`.
- The report library has company/type/year filters and a report-open progress path.
- AskAI retrieves report chunks by keyword/term expansion and returns page citations.

**Current gap vs P0**

- It accepts PDF only, only owner/admin can ingest, and requires security code/company/published-date/source URL metadata.
- Its 25 MB maximum and synchronous parse behavior are not suitable as the general analyst Notes ingestion service.
- Search is keyword/LIKE based; no report vector index.

### 3. Search and AskAI

**Already implemented**

- Global sidebar search searches document title/body/project/topics, report metadata, event text and claim text in the browser (`app/research-workspace.tsx`).
- AskAI can retrieve private-or-team `documents`, report chunks, event rows, and optionally Tavily web results before DeepSeek synthesis (`app/api/ask/route.ts`).
- AskAI Projects, Chats and Messages are already per-user tables and queries filter by `user_email`.
- Chat output has Markdown rendering through `app/markdown-answer.tsx`.
- Claims use local `bge-small-zh-v1.5` q8 vectors with a keyword blend and progress callback. It is a proven UI pattern for first-load messaging.

**Current gap vs P0**

- General Notes and reports still use literal/LIKE retrieval. The local vector implementation is not reusable unchanged for server-side cross-device search because it indexes browser memory only and gets rebuilt on a new device/session.
- No canonical entity dictionary. Chinese company name, English company name, ticker, exchange suffix, former name and aliases are not normalized to one ID.
- AskAI searches team notes and the caller's own notes correctly in the D1 route, but there is not yet an explicit access-controlled vector namespace for new private/team source types.
- No retrieval object for an Idea or Tracker exists, so AskAI cannot provide Idea lifecycle analysis beyond prose prompts.

### 4. Events / Claims

**Already implemented**

- `research_events`, `research_claims`, `research_event_claims`, `research_event_notices` already separate a claim from an event and have source / verification / relation fields.
- Event and Claim UI supports search, filters, source attribution, price paths and refresh on the full application.
- Claim vector search has Chinese semantic capability and user-visible load progress.

**Reuse recommendation**

- Use the Event DB relation-table pattern for `idea_notes`, `idea_claims`, `idea_events` and later `tracker_idea_links`, not unstructured JSON-only backlinks.
- Reuse its provenance fields (`source_system`, URL/title/locator/excerpt, confidence, created/updated timestamps) in Note extraction and Idea evidence tables.

### 5. Permissions and audit foundation

**Already implemented**

- Clerk sign-in resolves to D1 member status. Anonymous and suspended/non-member accounts fail closed.
- App roles are owner/admin/member; main routes consistently use `requireAppUser`.
- Owner/admin have broader management power for documents, corpus ingest and team members.
- The Supabase pilot design already specifies optimistic concurrency, soft delete, immutable audit records, team/private vector namespaces and background jobs.

**Current gap vs P0**

- The D1 main application does not yet implement version checking, soft deletion or audit records for documents/events/claims.
- There is no domain permission such as Idea proposer / reviewer / approver. Role policy must be defined explicitly instead of assuming generic owner/admin behavior.
- Static EdgeOne continuity APIs use a different Clerk/Supabase implementation, so policy duplication is a live risk.

## Minimum P0 data contract

Keep the present `documents` table as the raw Notes/file envelope for backwards compatibility, then add additive tables rather than replacing it.

| Entity | Purpose | Minimum fields |
|---|---|---|
| `research_entities` | canonical company/ticker/alias layer | id, canonical_name, ticker, exchange, aliases, industry, active, source, updated_at |
| `note_records` | analyst-facing Note type and parse/review lifecycle | document_id, template_type, parse_status, extraction_json, reviewed_by, reviewed_at, version, deleted_at |
| `note_entities` | Notes ↔ canonical companies/tickers | note_id, entity_id, relation, confidence |
| `ideas` | formal Idea Book record | id, owner, title, direction, status, thesis, catalyst, risks, invalidation_conditions, conviction, submitted_at, reviewed_by, reviewed_at, version, deleted_at |
| `idea_notes` | evidence link back to raw Notes | idea_id, note_id, relation, created_by, created_at |
| `idea_entities` | a primary ticker plus related securities | idea_id, entity_id, relation, weight/order |
| `idea_reviews` | auditable PM review / decision history | id, idea_id, reviewer, outcome, rationale, created_at |

Do **not** add Tracker persistence to P0. Add only `Idea → entity` and `Idea → Note` relations so P1 can safely attach tracker snapshots without retrofitting IDs.

## Minimal component and route reuse map

| Need | Reuse / evolve | Why |
|---|---|---|
| Notes nav + list + detail | `DocumentDesk` inside `app/research-workspace.tsx` | Already handles selected material, edit/delete, and team/personal labels |
| Upload UI | existing composer + `fileRef` near the end of `app/research-workspace.tsx` | Replace direct submit with queued upload state; preserve current metadata form |
| Raw files | `app/api/documents/route.ts` + R2 `FILES` | Existing auth, storage and source metadata boundary |
| Large upload pattern | `app/api/corpus/bootstrap/*` | Existing multipart/chunked contract is the closest reusable primitive |
| Extraction state UI | add to the document list/detail, not a new standalone page | Keeps Notes submission, parse result and review together |
| Idea list/detail | event split-pane patterns in `app/event-research.tsx` | Already designed for filters, selected rows, evidence, and side detail |
| Evidence links | event↔claim relation schema/API pattern | Proven relation table rather than embedding links in rich text |
| Semantic search feedback | `lib/local-claim-vector-search.ts` progress callback UX | Reuse status copy/UI behavior, not browser-only storage architecture |
| AskAI context launcher | existing `askAbout()` pattern in `app/research-workspace.tsx` | Pass selected Note/Idea scope into the one unified AskAI history |

## Proposed P0 release sequence

1. **Runtime decision + migration contract** — choose the one production backend; add additive D1/Supabase schema only for entities, Notes metadata, Ideas and relations. Define reviewer policy and optimistic concurrency.
2. **Notes upload reliability** — queued/chunked upload for large files, explicit `Uploading → Stored → Parsing → Ready / Needs review / Failed` state, original-file retention, retry and no page-blocking.
3. **Extraction adapter** — first supports the three team-standard inputs: meeting-note DOCX, investment-memo DOCX, weekly tracker XLSX. Persist raw parser output separately from reviewer-approved fields. OCR/image/PPT remain explicit later states, never silently "parsed".
4. **Entity resolution** — immutable canonical entity table + aliases. Determine entity before any lexical/vector ranking; show ambiguity to reviewer rather than guessing a ticker.
5. **Idea Book** — draft/submitted/PM-review/active/rejected/archived status; create from approved Note or independently. Require review decision and link all source Notes.
6. **Retrieval upgrade** — exact entity/ticker retrieval first; keyword fallback; then server-side multilingual embeddings and ACL-scoped vector namespaces. DeepSeek remains re-ranker/synthesizer, not the source of truth for ticker matching.
7. **P0 verification** — auth/ACL tests, large upload/retry test, parse-failure test, exact Chinese-name/ticker/alias search tests, Idea review state-transition tests, and one mobile upload walkthrough.

## Test and build commands currently available

```bash
npm run lint
npm run build
npm test
npm run test
npm run edgeone-demo:build
npm run edgeone-demo:build:research
```

`npm run test` invokes `npm run build` first and then `node --test tests/*.test.mjs`. The exact test files should be listed before work begins because the reconnaissance did not find a complete P0 Notes/Idea test suite.

## Risks to resolve before implementation

1. **Production split**: full D1/R2 app and static EdgeOne demo are not equivalent. Decide which receives P0 writes and ACL enforcement.
2. **Parser scope**: “supports many formats” must not become false completion. P0 should guarantee DOCX/PDF/XLSX intake with known states; OCR/PPT/images can be stored and flagged `needs_review` until an extraction worker exists.
3. **Privacy**: raw analyst files and extracted content need team ACLs, audit, soft delete and server-side indexing before all analysts can upload.
4. **Company identity**: name/ticker resolution needs a controlled mapping table; semantic search alone cannot safely solve aliases, multiple listings, or Chinese abbreviation ambiguity.
5. **Background execution**: a real parser/index queue needs a server runtime. Browser-only parsing and static deployment cannot be the durable team workflow.

## Bottom line

P0 is feasible as an incremental extension. The best first implementation is **Notes Inbox + canonical entity map + reviewed Idea Book**, built on the existing `documents` envelope and Event DB relation/provenance patterns. The Tracker library should be P1, using the same entity and Idea IDs rather than being a second document list.
