# Architecture — Context Infra V2

## Existing Context

The first release stores document metadata in D1, attachments in R2, and exposes a responsive owner-only PWA.

## Proposed Shape

- Level Grind Web: capture, search, personal context, team context, task context, and boundary status.
- D1 Context Layer: documents, document context metadata, personal profiles, and task packs.
- R2: attachment bytes.
- Future controlled connectors: company AVD, Obsidian, Excel, and external data sources.
- Future specialized stacks: async intelligence services and Quant research.

## Data Model

- `documents`: content, ownership, visibility, attachment metadata, timestamps.
- `document_context`: scope, source system, topics, event date, confidence.
- `personal_contexts`: coverage, preferences, working method, private memory.
- `task_contexts`: objective, topic, allowed context, output format, guardrails, state.

## API / Contract

| Area | Route | Request | Response | Errors |
|---|---|---|---|---|
| Materials | `GET /api/documents` | scope, query | authorized documents plus context metadata | 401 |
| Materials | `POST /api/documents` | context-aware multipart form | created id | 400, 401 |
| Context | `GET /api/context` | authenticated user | profile, tasks, topics, sources, counts | 401 |
| Context | `POST /api/context` | profile or task form | saved status / id | 400, 401 |
| Files | `GET /api/files/:id` | authenticated user | authorized attachment | 401, 404 |

## Frontend Flow

1. Capture material with provenance and personal/team scope.
2. Maintain personal research method privately.
3. Review approved team topics and sources.
4. Prepare a minimum-sufficient task pack.
5. Route later execution to a governed connector.

## Security / Privacy

- Authorization is enforced on server routes.
- Private materials require owner email for list and download access.
- Team access uses the deployment access boundary in the current preview.
- External connector cards describe architecture only; they do not imply live access.

## Migration / Compatibility

- `document_context` is additive and joined with fallbacks for existing records.
- Existing `documents` and R2 keys remain unchanged.
- New tables are created through migrations and guarded runtime initialization.
