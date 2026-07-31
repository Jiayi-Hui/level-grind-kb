# Architecture — Level Grind Research OS

## Existing Context

The current release is a multi-user Clerk-protected PWA. D1 stores identities,
metadata, indexed report pages, preferences, usage, and query history. R2 stores
attachments and report bytes.

## Proposed Shape

- Level Grind Web: research inbox, report library, evidence-mode assistant,
  history, and settings.
- D1 Research Layer: documents, report page text, personal profiles,
  preferences/quotas, membership, AI usage, and saved research queries.
- R2: attachment bytes.
- DeepSeek: model reasoning and synthesis through a server-side API key.
- Web search tool: optional server-side provider. It supplies results to
  DeepSeek; it is not bundled into the DeepSeek API.
- Future controlled connectors: company AVD, Obsidian, Excel, and external data sources.
- Future specialized stacks: async intelligence services and Quant research.

## Data Model

- `documents`: content, ownership, visibility, attachment metadata, timestamps.
- `document_context`: scope, source system, topics, event date, confidence.
- `personal_contexts`: coverage, preferences, working method, private memory.
- `task_contexts`: objective, topic, allowed context, output format, guardrails, state.
- `routing_policies`: private reminder toggle and scope-shift rules.
- `conversation_workstreams`: project, chat, active goal, deliverable, shift reason, route recommendation, and handoff summary.
- `team_members`: verified email, display name, role, status, inviter, and timestamps.
- `user_preferences`: language, personal storage quota, and update timestamp.
- `research_queries`: private question/answer history, evidence mode, serialized
  citations/results, model usage, and timestamp.
- `research_events`: candidate or confirmed real-world changes used as the
  primary team timeline.
- `research_claims`: source-attributed facts, forecasts, rumors, estimates,
  interpretations, and denials.
- `research_event_claims`: typed many-to-many Claim–Event relations.
- `research_event_notices`: who surfaced, questioned, challenged, escalated, or
  acted on an Event, with time and channel.
- `model_workbooks`: model registry, company, ticker, sector, owner, version,
  R2 workbook key, source notes, and timestamps.
- `model_variables`: typed input/calculation/output map with sheet/cell address,
  value/formula, period, source lineage, and stale state.
- `model_update_queue`: report/event-derived review candidates, proposed value,
  analyst decision, and review timestamps.
- `model_change_log`: immutable user-facing audit trail for uploads, input edits,
  and approved source updates.

## API / Contract

| Area | Route | Request | Response | Errors |
|---|---|---|---|---|
| Materials | `GET /api/documents` | scope, query | authorized documents plus context metadata | 401 |
| Materials | `POST /api/documents` | context-aware multipart form | created id | 400, 401 |
| Context | `GET /api/context` | authenticated user | profile, tasks, topics, sources, counts | 401 |
| Context | `POST /api/context` | profile or task form | saved status / id | 400, 401 |
| Preferences | `GET /api/preferences` | authenticated user | language, storage, shared-corpus size | 401 |
| Preferences | `POST /api/preferences` | language | saved preference | 400, 401 |
| Research | `GET /api/ask` | authenticated user | private saved query history | 401 |
| Research | `POST /api/ask` | question, evidence mode | answer, citations, web results, usage | 400, 401, 503 |
| Members | `GET /api/members` | authenticated member | team roster and current role | 401 |
| Members | `POST /api/members` | owner/admin plus member details | saved membership | 400, 401, 403, 409 |
| Files | `GET /api/files/:id` | authenticated user | authorized attachment | 401, 404 |
| Events | `GET/POST /api/events` | filters / admin event input | Event timeline with Claim/Notice counts | 400, 401, 403 |
| Claims | `GET/POST /api/claims` | filters / admin claim input | Claims inbox with Event links | 400, 401, 403 |
| Notices | `GET/POST /api/event-notices` | event filter / admin notice input | Team attention records | 400, 401, 403 |
| Model registry | `GET/POST /api/models` | selected id / workbook multipart form | model list, variable map, queue, history / created model | 400, 401, 404 |
| Model operations | `PATCH /api/models` | update input, scan sources, or approve update | saved state or pending count | 400, 401, 404 |
| Model file | `GET /api/models/files/:id` | authorized model id | original `.xlsx` from R2 | 401, 404 |
| Claim inbox | `POST /api/claims/inbox` | secret header + WeChat/Codex claim payload | idempotent persisted Claim | 400, 401 |

## Frontend Flow

1. Capture material with provenance and personal/team scope.
2. Ask from indexed reports, the public web, or both.
3. Review source-separated citations and deliberately save useful web evidence.
4. Reopen prior work from the Research Q&A Chats list or export it to Obsidian.
5. Launch a scoped question from any knowledge, report, or event item; the
   resulting conversation remains in Research Q&A.
6. Register a workbook, review mapped inputs and outputs, scan newer company
   evidence, approve values, and export an updated Excel file.
7. Maintain language, research profile, storage, and team access in Settings.

## Security / Privacy

- Authorization is enforced on server routes.
- Private materials require owner email for list and download access.
- Team access uses the deployment access boundary in the current preview.
- External connector cards describe architecture only; they do not imply live access.
- Clerk validates the session before preferences, history, or research data are
  read or written.
- Clerk authentication is followed by D1 membership authorization on every protected route.
- `LEVEL_GRIND_OWNER_EMAIL` bootstraps one owner; legacy invited emails migrate into member rows.
- Suspended members fail closed, and the owner cannot be demoted through the member endpoint.
- Query history is filtered by authenticated user email.
- Web search keys and model keys remain server-side.

## Migration / Compatibility

- `document_context` is additive and joined with fallbacks for existing records.
- Existing `documents` and R2 keys remain unchanged.
- New tables are created through migrations and guarded runtime initialization.
- Routing/context tables remain for backwards compatibility but are no longer
  exposed in the main interface.
- Preferences and query history are additive tables with guarded runtime
  initialization for hosted D1.
- Claim and Team Notice tables are additive. The legacy `raw_claim` Event
  column remains readable for compatibility but is no longer the canonical
  Claim store.
- Model Workbench tables are additive. Workbook bytes remain in R2; the browser
  parser reads only the template mapping and never evaluates arbitrary formulas.
- Export rewrites mapped input cells and enables full recalculation in Excel.
  This preserves Excel as the authoritative calculation engine while the web
  application governs metadata, review, and lineage.

## PM Event Demo Flow

```text
WeChat Bot
  -> existing local WeChat/Codex bridge
  -> Claim Inbox API (server-side shared secret)
  -> D1 research_claims (+ optional Claim–Event relation)
  -> authenticated Event DB polling every 3 seconds
  -> live Claim band + Claims inbox

event-db validated research snapshot
  -> portable sanitized event-research.json
  -> Level Grind Event Research
  -> cross-event search, price paths, sector/security dispersion
  -> deterministic investment read-through
  -> scoped AskAI handoff for deeper synthesis
```

The historical price-reaction snapshot is sanitized and versioned with source
code. Live Claims remain in D1. The shared ingestion secret is configured only
in the hosted runtime and the local Codex bridge.

## AI Capex portable research boundary

```text
aidc-capex-tracker (research source)
  -> Epoch AI open CSV snapshot + reviewed Level Grind exports when present
  -> scripts/sync-aidc-capex.mjs (build-time only)
  -> data/aidc-capex/dashboard.json + manifest.json
  -> public/data/aidc-capex/dashboard.json + manifest.json
  -> AICapex client view fetches portable JSON
```

The browser never reads CSV and never references the sibling repository. The
tracked `data/` copy is the handover/fallback source; the `public/` copy is the
runtime asset.

### `aidc-capex.v1` contract

- metadata: `schemaVersion`, `generatedAt`, `syncedAtHkt`, `dataCutoff`,
  `modelVersion`, review state, limitations, and file integrity;
- sourceSnapshots and sources: dataset-level attribution plus exact
  project-support URLs or safe asset identifiers;
- kpis and owners: current Epoch baseline for campus count, IT MW, H100e, and
  estimated 2025-USD capital cost;
- capacityTimeline: quarter-end project snapshots separated into historical
  and Epoch-baseline planned values;
- statusPipeline: campus counts and current IT MW by evidence-aware baseline
  status;
- projects: location, current metrics, status, confidence, observation date,
  freshness, timeline, chip quantities, calculation link, and source ids;
- reviewedForecasts: empty until the research export contains approved
  p10/p50/p90 records.

### Dates and freshness

- observation date comes from the latest applicable project timeline record;
- source date comes from the source itself and remains null when unavailable;
- data cutoff is the research inclusion boundary;
- synced at is the product import time and never determines source freshness.

Baseline freshness uses observation age against the data cutoff: Current
`<=120` days, Aging `121–240`, Stale `>240`, Unknown when no reliable
observation date exists. This rule is exported as method metadata.

### Compatibility

The integration is additive: one client component, one portable-data sync
script, navigation/i18n additions, styles, and focused tests. It adds no D1/R2
schema and does not alter existing Event DB, Model Workbench, authentication,
or report-storage contracts.

## Real Claim Ledger portable boundary

```text
wechat_claim_date_ledger_2026-07-28.xlsx
  -> tracked normalized Claim source (45)

Bloomberg Desktop-derived event study
  + AKShare/yfinance public rerun
  + Dymon/BBG verification findings
  -> scripts/sync-claim-ledger.mjs
  -> claim-ledger.v1 portable JSON
  -> Event DB claim list, event-window charts, evidence rows, comparison
```

The Claim content state, timestamp evidence, security mapping, price event
window, and verification evidence are independent fields. In particular,
successful BBG/public price reconciliation does not validate the underlying
group-chat statement.

The legacy 10-event narrative snapshot remains tracked for provenance but is no
longer the Tencent Event DB presentation source.

## Tencent authentication boundary

The Tencent EdgeOne continuity build uses the existing Clerk public client and
session gate. The publishable key is intentionally present in the browser
bundle; no Clerk secret is shipped.

This gate controls the rendered application experience only. Static JSON assets
on EdgeOne are not confidential resources. Server-enforced membership,
protected data responses, write APIs, and migrated D1/R2 records require a
Tencent full-stack runtime and are outside this static cutover.

## V5.4 Tencent function and geospatial boundary

- `cloud-functions/api/invitations.js` verifies the Clerk session JWT against
  Clerk JWKS, confirms the configured workspace owner email, and calls Clerk's
  Backend Invitation API. `CLERK_SECRET_KEY` stays in Tencent environment
  variables.
- `scripts/geocode-aidc-capex.mjs` keeps a repeatable OpenStreetMap Nominatim
  cache outside the generated AIDC folder and emits a browser-ready copy during
  the Tencent build.
- The world basemap is bundled from `world-atlas`; project bubbles use only
  source-derived addresses and cached geocodes.
- Claim edits use browser local storage in this release. This is deliberately
  separate from the immutable published Claim snapshot and is not described as
  multi-user persistence.

## V5.5 Agentic research boundary

```text
Event DB / AI Capex portable JSON
  -> browser ranks a bounded context subset for the current question
  -> authenticated /api/agent-chat cloud function
  -> optional Tavily Search
  -> DeepSeek Chat Completions
  -> cited answer + usage metadata
  -> device-local project/chat store
  -> Personal Knowledge / Markdown / Obsidian URI
```

The function validates request sizes and treats retrieved material as evidence,
not instructions. Tavily uses Basic search by default to preserve credits.
DeepSeek receives only the last six messages and a bounded context package.

## V5.6 interaction and return-integrity boundary

- Event DB and AI Capex launch one `AgenticResearchPanel` through the
  top-level `ask` view. Scope is carried in React state and the user can return
  to the originating database.
- `sync-claim-ledger.mjs` considers a horizon observed only when both its
  trading date and a positive closing price exist. Upstream `return = -1`
  placeholders with a null date/price are normalized to null before the
  portable JSON is written.
- Event company and industry/theme dimensions are derived from mapping type:
  direct mappings populate company; proxy baskets populate industry/theme.
- The Settings member list is server-derived from Clerk users and invitations.
  The same owner-only JWT verification protects both listing and invitation
  creation.

## V5.7 public price refresh and alias boundary

```text
portable Claim ledger (sanitized speaker alias + verified snapshot)
  -> browser extracts bounded Yahoo symbols
  -> /api/market-prices (max 10 symbols/request)
  -> Yahoo Finance chart endpoint (3-month daily close)
  -> normalized observed prices + explicit per-symbol errors
  -> browser rebuilds event-session horizons
  -> 5-minute refresh; verified snapshot fallback
```

The alias is applied in the sync script before either tracked dashboard copy is
written, so it protects interface text, downloadable JSON, and LLM context.
Real names remain only in the non-published local source ledger.

## V5.12 GitHub and shared-data boundary

```text
feature/* -> main -> production
                         |
                         v
                  GitHub Actions
                         |
                         v
              Tencent EdgeOne Makers
                         |
                         v
                  level-grind.com
```

Production CI runs `aidc:publish`, which validates and copies tracked JSON plus
geocodes. Research refresh is a separate operator action and may read
`AIDC_RESEARCH_ROOT`; runtime and CI never require the sibling repository.

The durable shared-data target is a company-approved PostgreSQL-compatible
service plus EdgeOne Blob for file bytes. Neither laptop is a server. Clerk
subject IDs map to application users; private rows always carry an owner ID;
team rows are filtered through membership and ACL checks. Optimistic versions,
soft deletion, append-only audit records, private/team vector namespaces, and
background jobs are part of the base contract in `infra/shared-data/`.

## V5.11 AI Capex location-evidence hierarchy

```text
Epoch timeline/source explicit latitude-longitude
  -> Epoch Satellite Explorer selected-campus lngLat
  -> reviewed permit / land-use / parcel override
  -> complete-address geocoding (US Census and/or Nominatim)
  -> city/county centroid, visibly marked place-level
  -> unresolved and omitted from the map
```

`scripts/geocode-aidc-capex.mjs` reads the local Epoch campus and timeline CSVs,
extracts explicit map coordinates, resolves official Epoch directory slugs from
the Epoch data sitemap, and parses the selected campus location embedded in the
Satellite Explorer. It records `precision`, `evidenceTier`, and the supporting
URL with every coordinate. `data/aidc-capex-location-overrides.json` is the
reviewed extension point for future permit or parcel evidence; it does not
contain fabricated defaults.

The basemap remains a browser-rendered `world-atlas` asset. OpenStreetMap is
only a fourth/fifth-tier geocoder and map link, not the source of Epoch's
research geometry.
