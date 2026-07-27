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
