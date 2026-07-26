# Architecture — Context Infra V3

## Existing Context

The first release stores document metadata in D1, attachments in R2, and exposes a responsive owner-only PWA.

## Proposed Shape

- Level Grind Web: capture, search, personal context, team context, task context, conversation routing, and boundary status.
- D1 Context Layer: documents, document context metadata, personal profiles, task packs, routing policies, and workstream handoffs.
- R2: attachment bytes.
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

## API / Contract

| Area | Route | Request | Response | Errors |
|---|---|---|---|---|
| Materials | `GET /api/documents` | scope, query | authorized documents plus context metadata | 401 |
| Materials | `POST /api/documents` | context-aware multipart form | created id | 400, 401 |
| Context | `GET /api/context` | authenticated user | profile, tasks, topics, sources, counts | 401 |
| Context | `POST /api/context` | profile or task form | saved status / id | 400, 401 |
| Routing | `GET /api/routing` | Clerk bearer token | private policy and owner workstreams | 401 |
| Routing | `POST /api/routing` | policy or workstream form | saved status / id | 400, 401 |
| Members | `GET /api/members` | authenticated member | team roster and current role | 401 |
| Members | `POST /api/members` | owner/admin plus member details | saved membership | 400, 401, 403, 409 |
| Files | `GET /api/files/:id` | authenticated user | authorized attachment | 401, 404 |

## Frontend Flow

1. Capture material with provenance and personal/team scope.
2. Maintain personal research method privately.
3. Review approved team topics and sources.
4. Prepare a minimum-sufficient task pack.
5. Route later execution to a governed connector.
6. Save a conversation handoff when the active goal or project changes.
7. Continue work on another device by syncing validated repository changes through GitHub; D1 and R2 remain cloud state.

## Security / Privacy

- Authorization is enforced on server routes.
- Private materials require owner email for list and download access.
- Team access uses the deployment access boundary in the current preview.
- External connector cards describe architecture only; they do not imply live access.
- Clerk validates bearer tokens before routing preferences or workstreams are read or written.
- Clerk authentication is followed by D1 membership authorization on every protected route.
- `LEVEL_GRIND_OWNER_EMAIL` bootstraps one owner; legacy invited emails migrate into member rows.
- Suspended members fail closed, and the owner cannot be demoted through the member endpoint.
- Workstreams are filtered by the authenticated owner email.
- Automatic drift detection is not claimed until a chat-history connector exists.

## Migration / Compatibility

- `document_context` is additive and joined with fallbacks for existing records.
- Existing `documents` and R2 keys remain unchanged.
- New tables are created through migrations and guarded runtime initialization.
- Routing tables are additive; existing context records are unchanged.
