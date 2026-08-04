# P0 schema reconnaissance — Notes, Idea Book, source files, entities

> Superseded note (2026-08-04): the D1/Blob and Supabase options below are
> retained as historical reconnaissance only. The accepted implementation is
> TencentDB PostgreSQL + private COS + the authenticated Tencent Notes service
> described in `p0-architecture.md` and `p0-deployment-qa.md`.

Date: 2026-08-02  
Scope: read-only reconnaissance of the current D1/Drizzle schema and the planned Supabase PostgreSQL shared-data foundation. No application code or production migration was changed.

## Executive conclusion

The system can add the P0 research-workspace objects incrementally. It should **not** try to turn `documents` into the canonical source for every new research object, nor reuse `research_claims` as the Idea Book.

The appropriate target is:

```text
source file / uploaded note
  → research_note
  → note ↔ entity/ticker
  → candidate / approved idea
  → idea ↔ note / claim / event / tracker
```

The existing shared PostgreSQL foundation already has the right cross-cutting primitives—`app_users`, memberships, object metadata, evidence, versions, soft deletes, vectors, background jobs, and audit log. P0 needs a small set of new domain tables and link tables on top of it. This is an additive migration, not a rewrite.

## What exists now

### Live application storage: Cloudflare D1 + Blob/R2-style `env.FILES`

The deployed app currently reads and writes D1 directly from Next/EdgeOne route handlers. Several routes also issue `CREATE TABLE IF NOT EXISTS` at runtime, so Drizzle migration files are a useful record but are not the sole live schema authority.

| Existing object | Current role | Reuse recommendation |
|---|---|---|
| `documents` + `document_context` | Generic team/personal note/link/file record. Includes body, author, project, file key/name/type/size, source system, topics, date, confidence. | Keep as legacy/general Knowledge Base during transition. Do not overload it with formal Idea lifecycle fields. New upload flow may create a `source_files` record and a `research_notes` record, then optionally backfill a compatible `documents` projection for old UI. |
| `corpus_documents` + `corpus_chunks` | Report/PDF library and extracted page text. | Keep for report ingestion. A report can be a `source_file` plus a `research_note`/evidence link; do not duplicate PDFs. |
| `research_claims` + `research_events` + link/notices | Event research, claims, verification and market reaction. | Keep as Event DB. Add generic entity links rather than another company/ticker column family. |
| `model_workbooks`, variables, queue, changelog | Excel model operations. | Reuse `company`, `ticker`, `owner` link once entity normalization is available; no immediate schema rewrite. |
| `team_members`, Clerk-derived `AppUser` | D1 authorization for current app. | Current short-term auth. The shared DB already has a richer `app_users` and `team_memberships` model. |
| `research_projects`, chats, messages | User-private AskAI history. | Preserve as private data. P0 Notes/Ideas may be cited by AskAI but must not make chats public by default. |

Notable D1 constraints:

- `documents` is team/private by a `visibility` text field and author email, without versioning, soft-delete, or a first-class ACL.
- Its current upload limit is 25 MB in `app/api/documents/route.ts`; parsing is synchronous from the route’s perspective.
- Search is SQL `LIKE` over title/body/project/topics. It is not an entity-aware or server-side semantic index.
- Direct `company` / `ticker` strings are duplicated in Events, Claims, Reports and Models, so aliases such as Chinese name / English name / Bloomberg / Wind / Yahoo are not canonical yet.

### Planned durable shared storage: Supabase PostgreSQL

`infra/shared-data/postgres/001_shared_research.sql` defines the intended shared relational layer. Its data ownership rules already match P0:

- `stored_objects`: bytes live in object storage; DB holds object metadata, SHA-256, scope and soft deletion.
- `knowledge_items`: editable private/team knowledge with version, ACL, publishing lineage and optional source object.
- `evidence_records`: sources, source/observation/access dates, rights and verification.
- `vector_documents`: separate team/private namespaces, source IDs and content hashes.
- `background_jobs`: parser/indexer/geocoder/price-refresh queue.
- `audit_log`: immutable mutation history.
- `app_users` / `team_memberships`: user identity and roles already include Owner, Admin, Analyst, PM and GEM PM.

`002_weekend_shared_state.sql` additionally proves an optimistic-concurrency/audit pattern through `team_claim_overlays`. Reuse that transaction/function pattern for Ideas and shared Notes instead of allowing last-write-wins.

### Important reality check

The repository contains this shared PostgreSQL design, but the visible route handlers still use `env.DB` D1 for the product. Therefore P0 should choose one write authority per release:

1. **Pilot P0:** D1/Blob remains the runtime authority, while the PostgreSQL migration is prepared but not yet wired. This is fastest, but cannot honestly claim durable shared cross-device collaboration until the migration is wired.
2. **Durable P0 (recommended once Supabase server secrets are available):** new Notes, Ideas, source files, entity map and their links write only to PostgreSQL + Blob; D1 remains read-only legacy/Event/Report storage until a planned migration.

Do not dual-write the same Note or Idea to D1 and PostgreSQL in the first release. Dual-write creates divergence without an authoritative conflict policy.

## Recommended P0 domain model

### 1. `entities`: the canonical company/instrument object

This is the missing piece behind reliable Chinese-name, English-name and ticker search. It must be a first-class record, not a JSON list embedded in Notes.

```sql
CREATE TABLE entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('company', 'security', 'index', 'commodity', 'industry', 'person')),
  canonical_name text NOT NULL,
  legal_name text,
  primary_ticker text,
  primary_exchange text,
  country text,
  industry text,
  status text NOT NULL DEFAULT 'active',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES app_users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id)
);

CREATE UNIQUE INDEX entities_primary_ticker_idx
  ON entities(primary_ticker, primary_exchange)
  WHERE primary_ticker IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE entity_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entities(id),
  identifier_type text NOT NULL CHECK (identifier_type IN (
    'ticker', 'bloomberg', 'wind', 'yahoo', 'isin', 'cusip', 'lei', 'internal'
  )),
  identifier_value text NOT NULL,
  exchange text,
  is_primary boolean NOT NULL DEFAULT false,
  valid_from date,
  valid_to date,
  source_evidence_id uuid REFERENCES evidence_records(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (identifier_type, identifier_value, COALESCE(exchange, ''))
);

CREATE TABLE entity_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entities(id),
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  language text,
  alias_type text NOT NULL DEFAULT 'name',
  source_evidence_id uuid REFERENCES evidence_records(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, normalized_alias)
);
CREATE INDEX entity_aliases_lookup_idx ON entity_aliases(normalized_alias);
```

Implementation note: Postgres does not permit an expression such as `COALESCE(exchange, '')` inside a regular `UNIQUE` constraint; use the shown unique index rather than an inline constraint. The final migration should use a normalized `exchange NOT NULL DEFAULT ''` if we want simpler semantics.

**Why this should precede semantic retrieval:** exact alias/ticker resolution is deterministic and auditable. Vector search can then search expanded aliases and rank related Notes/Ideas, but it should never decide a ticker by itself.

### 2. `source_files`: the shared intake and parsing object

`stored_objects` should remain the byte/object metadata layer. `source_files` is the research-specific layer: template type, parser state, source provenance and raw-vs-extracted relationship.

```sql
CREATE TYPE parse_status AS ENUM (
  'uploaded', 'queued', 'processing', 'parsed', 'partially_parsed', 'failed', 'needs_review'
);

CREATE TABLE source_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id uuid NOT NULL UNIQUE REFERENCES stored_objects(id),
  scope data_scope NOT NULL DEFAULT 'team',
  source_kind text NOT NULL CHECK (source_kind IN (
    'meeting_note', 'investment_memo', 'weekly_tracker', 'report', 'model', 'other'
  )),
  template_key text,
  template_version text,
  parse_status parse_status NOT NULL DEFAULT 'uploaded',
  parser_name text,
  parser_version text,
  extraction_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  extraction_error text,
  source_date date,
  received_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid NOT NULL REFERENCES app_users(id),
  reviewed_by uuid REFERENCES app_users(id),
  reviewed_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id)
);
CREATE INDEX source_files_status_idx ON source_files(parse_status, received_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX source_files_kind_idx ON source_files(source_kind, source_date DESC)
  WHERE deleted_at IS NULL;
```

Do not store the original Word/PDF/XLSX body in `extraction_json`. Store raw bytes in Blob via `stored_objects`; extracted fields and a low-risk parser trace go here. A failed parser must leave the original file available and record `failed` / `needs_review` rather than losing the upload.

### 3. `research_notes`: the team-visible research object

Use this rather than trying to convert every `knowledge_items` row into a meeting note. `knowledge_items` can remain a general saved answer/manual knowledge card; a research Note needs source file, structured template type, owner/author, dates and status.

```sql
CREATE TYPE review_status AS ENUM ('draft', 'needs_review', 'approved', 'rejected', 'archived');

CREATE TABLE research_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope data_scope NOT NULL DEFAULT 'team',
  source_file_id uuid REFERENCES source_files(id),
  note_type text NOT NULL CHECK (note_type IN (
    'meeting_note', 'weekly_note', 'report_note', 'company_call', 'expert_call', 'manual_note'
  )),
  title text NOT NULL,
  body_markdown text NOT NULL DEFAULT '',
  executive_summary text,
  meeting_at timestamptz,
  source_date date,
  author_user_id uuid NOT NULL REFERENCES app_users(id),
  owner_user_id uuid REFERENCES app_users(id),
  status review_status NOT NULL DEFAULT 'needs_review',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id)
);
CREATE INDEX research_notes_scope_date_idx
  ON research_notes(scope, COALESCE(source_date, created_at) DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX research_notes_author_idx ON research_notes(author_user_id, updated_at DESC)
  WHERE deleted_at IS NULL;
```

Note template-specific fields should initially live in a conservative `research_note_fields` JSONB extension table or in `source_files.extraction_json`; add dedicated columns only after the team has used the templates for several cycles. This avoids baking every Word-template cell into permanent schema before it proves stable.

### 4. `ideas`: the formal Idea Book object

Ideas should never be inferred solely from Notes. They need their own owner, PM approval, state, time horizon, direction, thesis and invalidation condition.

```sql
CREATE TYPE idea_status AS ENUM ('draft', 'pm_review', 'active', 'tracking', 'validated', 'rejected', 'archived');

CREATE TABLE ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope data_scope NOT NULL DEFAULT 'team',
  title text NOT NULL,
  idea_type text NOT NULL CHECK (idea_type IN ('long', 'short', 'pair', 'watchlist', 'sector', 'macro')),
  status idea_status NOT NULL DEFAULT 'draft',
  thesis_markdown text NOT NULL DEFAULT '',
  catalyst_markdown text,
  risk_markdown text,
  invalidation_condition text,
  time_horizon text,
  conviction text,
  owner_user_id uuid NOT NULL REFERENCES app_users(id),
  submitted_at timestamptz,
  reviewed_by uuid REFERENCES app_users(id),
  reviewed_at timestamptz,
  review_note text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id)
);
CREATE INDEX ideas_status_updated_idx ON ideas(status, updated_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX ideas_owner_updated_idx ON ideas(owner_user_id, updated_at DESC)
  WHERE deleted_at IS NULL;
```

Do **not** place `company`, `ticker` and `industry` text directly on `ideas` as the new canonical design. An Idea can be a pair/sector/macro view, and the entity links need role semantics.

### 5. General link tables: avoid a different company/ticker column on every object

```sql
CREATE TABLE research_object_entities (
  object_type text NOT NULL CHECK (object_type IN ('source_file', 'note', 'idea', 'claim', 'event', 'report', 'tracker')),
  object_id uuid NOT NULL,
  entity_id uuid NOT NULL REFERENCES entities(id),
  relation text NOT NULL DEFAULT 'about' CHECK (relation IN (
    'about', 'primary', 'long_leg', 'short_leg', 'peer', 'supplier', 'customer', 'competitor', 'benchmark'
  )),
  confidence text NOT NULL DEFAULT 'medium',
  created_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (object_type, object_id, entity_id, relation)
);
CREATE INDEX research_object_entities_entity_idx ON research_object_entities(entity_id, object_type);

CREATE TABLE idea_note_links (
  idea_id uuid NOT NULL REFERENCES ideas(id),
  note_id uuid NOT NULL REFERENCES research_notes(id),
  relation text NOT NULL DEFAULT 'evidence' CHECK (relation IN ('origin', 'evidence', 'supports', 'contradicts', 'update')),
  created_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (idea_id, note_id, relation)
);

CREATE TABLE idea_claim_links (
  idea_id uuid NOT NULL REFERENCES ideas(id),
  claim_id uuid NOT NULL REFERENCES claims(id),
  relation text NOT NULL DEFAULT 'supports' CHECK (relation IN ('supports', 'contradicts', 'test_condition', 'context')),
  created_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (idea_id, claim_id, relation)
);

CREATE TABLE idea_event_links (
  idea_id uuid NOT NULL REFERENCES ideas(id),
  event_id uuid NOT NULL REFERENCES events(id),
  relation text NOT NULL DEFAULT 'catalyst' CHECK (relation IN ('catalyst', 'supports', 'contradicts', 'outcome')),
  created_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (idea_id, event_id, relation)
);
```

`research_object_entities` is intentionally polymorphic. If the team later needs database-enforced foreign keys per object type, split it into `note_entities`, `idea_entities`, `claim_entities`, etc. For P0, one audited relationship table is a better speed/complexity trade-off.

### 6. Template parsing / extraction review

The user is currently the controlled extraction gate. This should be explicit, not hidden in prompt logs:

```sql
CREATE TABLE extraction_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file_id uuid NOT NULL REFERENCES source_files(id),
  status job_status NOT NULL DEFAULT 'queued',
  extractor text NOT NULL,
  extractor_version text,
  schema_version text NOT NULL,
  output_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  reviewed_by uuid REFERENCES app_users(id),
  reviewed_at timestamptz
);
CREATE INDEX extraction_runs_file_created_idx ON extraction_runs(source_file_id, created_at DESC);
```

This allows Codex/offline extraction to deliver deterministic JSON that Jiayi accepts/rejects before it becomes a shared Note, Idea, Claim or Tracker snapshot. It also gives P0 clear upload states without promising a fully automatic production parser.

## Relationship to the existing shared tables

| Existing table | P0 relationship | Change required now? |
|---|---|---|
| `stored_objects` | One `source_files.object_id`; source bytes stay in Blob. | No structural change. |
| `knowledge_items` | A user can publish an AskAI result as a team knowledge item; optionally link it to an Idea later. It should not replace `research_notes`. | Add only an optional generic `knowledge_item_links` later, not P0 critical. |
| `evidence_records` | Source files, notes, claims, reports and imported market data can create evidence records. | Reuse as-is. Add `source_file_id` only if reports show a real need; object/evidence link is sufficient at P0. |
| `claims` / `events` | Link to entities and to Ideas via `idea_claim_links` / `idea_event_links`. | Existing company/ticker strings remain migration-era compatibility fields. |
| `reports` | A report file can be associated with one or more entities through generic links. | Reuse as-is. |
| `vector_documents` | Index chunks for `research_notes`, `ideas`, files/reports, keeping `team` and private namespaces separate. | Reuse as-is; embedding vectors are provider/runtime work, not schema work. |
| `background_jobs` | `parse_source_file`, `index_note`, `index_idea`, `refresh_tracker_prices` jobs. | Reuse as-is. |
| `audit_log` | All shared Notes/Ideas/review/mapping mutations append audit records. | Reuse existing append-only pattern. |

## Suggested migration order

Make a new PostgreSQL migration—do not edit the already-applied 001/002 files. Suggested filename:

```text
infra/shared-data/postgres/003_p0_research_workspace.sql
```

Order inside the migration:

1. New enums: `parse_status`, `review_status`, `idea_status`.
2. `entities`, identifiers, aliases.
3. `source_files`, `extraction_runs`.
4. `research_notes`.
5. `ideas`.
6. Entity and Idea relationship tables.
7. Indexes.
8. Row-level security policies / service-role-only mutation functions before the product route is pointed at these tables.

For the still-live D1 app, add an independent additive Drizzle migration only when P0 routes are explicitly implemented. Suggested sequence:

```text
drizzle/0013_p0_research_workspace.sql
```

Its D1 tables should mirror only the short-term pilot needs (`source_files`, `research_notes`, `ideas`, `entity_aliases`, and links). Avoid attempting to port the entire PostgreSQL audit/RLS/job system into D1.

## Permission and lifecycle rules to preserve

- All team Notes are readable by active team members; their raw source file access must use the same scope/ACL, not a public object key.
- An analyst may upload a Note. A formal Idea begins as `draft` / `pm_review`; it becomes active only through an approved review transition.
- AskAI chats remain private. “Publish to team knowledge” creates a new shared record and never exposes a whole private chat by reference.
- Require `expected_version` on any shared Note, Idea, entity alias or tracker mutation. Version conflict returns `409`, with current record/version offered for resolution.
- Delete is soft delete for all research objects. Object bytes need a separate retention/purge job after no active references remain.
- Entity aliases and ticker mappings require source/evidence or an explicit manual-review status. This is important because a bad mapping silently contaminates both search and future backtests.

## Search implications

The desired promise—search by Chinese name, English name, ticker and semantic topic—needs a composed retrieval flow:

```text
query
  → deterministic entity alias / identifier resolution
  → retrieve linked Notes, Ideas, Claims, Events, Reports, Trackers
  → lexical search in fields/chunks
  → vector candidate retrieval by permission namespace
  → DeepSeek rerank / answer synthesis with source links
```

DeepSeek should be the reranker/answer layer, not the only retrieval mechanism. It cannot substitute for the entity map. The current browser-local Hugging Face claim index is useful for demo semantic recall, but it is not a shared, permission-aware production index.

## Tracker boundary (P1, do not add premature columns in P0)

The Tiana weekly workbook demonstrates that a Tracker is not another Note. It is a versioned coverage universe plus time-series snapshots. P1 should add `tracker_books`, `tracker_entities`, `tracker_snapshots`, and later a `tracker_idea_links` table. Keep it separate from `ideas` so one company can have multiple Ideas over time and one Tracker can support multiple Ideas.

## P0 acceptance tests implied by this schema

1. Analyst uploads DOCX/PDF/XLSX; bytes are stored once and metadata creates a `source_file` with visible upload/parse state.
2. A parsed source creates a team Note with title/body/date/author and entity links; failure leaves original source intact.
3. Searching a Chinese company name, English name, ticker or approved alias returns the same linked Notes/Ideas where appropriate.
4. An analyst-created Idea enters `pm_review`; an authorized reviewer approves/rejects it with review history and audit record.
5. A Note links to more than one entity, and an Idea can be long/short/pair/sector without forcing one ticker field.
6. AskAI does not retrieve another user’s private Notes/chats; team Notes and Ideas are searchable only to team members.
7. Concurrent edit of a shared Idea/Note produces conflict rather than overwriting the first editor.

## Risks / open decisions for the architecture owner

1. **Write authority:** decide before implementation whether P0 shared workspace is D1 pilot or Supabase durable production. Do not hide this behind a UI toggle.
2. **Blob provider:** the shared design says EdgeOne Makers Blob, while deployed code still uses `env.FILES`. Confirm a single object-store abstraction so P0 upload code has no provider-specific table leakage.
3. **Entity seed source:** initial aliases/tickers should come from controlled coverage files plus verified market identifiers; do not scrape unreviewed names into the canonical map.
4. **Audit/ACL enforcement:** the PostgreSQL schema has audit tables but no RLS policies yet. Implement policy/function layer before exposing team uploads outside the sanitized pilot.
5. **Parsing architecture:** P0 may queue an extraction job and let Jiayi/Codex submit structured extraction. It should not claim full asynchronous cloud parsing until a worker and durable job processor are actually live.
