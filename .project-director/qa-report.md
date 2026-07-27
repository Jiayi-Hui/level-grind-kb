# QA Report — Context Infra V3

## Checks Run

| Check | Result | Notes |
|---|---|---|
| TypeScript | Pass | Strict no-emit check |
| Lint | Pass | No findings |
| Production build | Pass | Web route, four API routes, and Clerk sign-in/sign-up routes built |
| Automated tests | Pass | 2/2 context and boundary checks |
| D1 migration generation | Pass | Additive context tables and indexes inspected |
| Personal context save | Pass | Persisted and returned after a fresh request |
| Task context create | Pass | Persisted with scope, output, and guardrails |
| Context-aware capture | Pass | Source, topic, scope, date, and confidence persisted |
| Team aggregation | Pass | Topics, provenance, and counts returned |
| Conversation-routing migration | Pass | Additive tables, indexes, insert, and owner-filter query verified |
| Routing API authentication | Pass | Anonymous request returns 401 through Clerk server boundary |
| Clerk configuration guard | Pass | Missing public key renders an explicit configuration state |
| Invitation allowlist | Pass | Empty allowlist is fail-closed |
| Multi-user migration | Pass | Additive team member table and role/status indexes inspected |
| Member authorization | Pass | Owner/admin writes; member writes return 403 |
| Owner protection | Pass | Owner membership cannot be changed through the member endpoint |
| CNINFO universe routing | Pass | 49 listed companies reviewed; 15 A-share names routed to CNINFO |
| CNINFO metadata match | Pass | 30/30 exact-code full annual/half-year reports; summaries excluded |
| CNINFO file integrity | Pass | 30/30 PDF signatures, byte sizes, and SHA-256 values match manifest |
| Report storage contract | Pass | PDF bytes use R2 `FILES`; metadata, page chunks, and usage use D1 `DB` |
| Production corpus import | Pass | 30/30 reports and 6,237 PDF pages imported; second run confirmed every source was already present |
| Large-report ingestion | Pass | Interactive upload limit raised to 25 MB; bootstrap path chunks larger PDFs and page text |
| Bootstrap shutdown | Pass | Temporary production import credential removed after the verified batch |
| Provider boundary | Pass | API key remains server-side; DeepSeek/GLM/Kimi share one runtime-configured contract |
| Current validation | Pass | ESLint, TypeScript, production build, and 3/3 contract tests |
| Markdown answer rendering | Pass | Safe React renderer handles headings, bold, lists, links, and citation markers |
| Research history | Pass | Private per-user D1 history stores mode, answer, sources, model, tokens, and cost |
| Language persistence | Pass | Account preference API plus local first-paint fallback |
| Storage visibility | Pass | Personal attachment usage and owner/member quotas are separated from shared corpus bytes |
| Navigation boundary | Pass | Context pages and Conversation routing removed from the active app; routing API deleted |
| Report-open latency UX | Pass | Same-origin report route opens immediately in a new tab with button progress |
| Web research contract | Pass | Report/Web/Hybrid modes; missing search key returns explicit 503; Tavily adapter is server-only |
| Production deployment | Pass | Version 11 deployed successfully; homepage returns 200 and protected routes return 401 anonymously after edge propagation |

## Acceptance Mapping

| Criterion | Evidence |
|---|---|
| Existing material remains compatible | Additive join with fallbacks for old documents |
| Personal context persists | `personal_contexts` upsert and runtime probe |
| Team context is visible | Topic and source aggregation API plus Team Context view |
| Task packs persist | `task_contexts` create/list flow |
| Context metadata persists | `document_context` write/read flow |
| Visibility is server-enforced | Authorized list query and file-download condition |
| Boundaries are honest | Dedicated view labels active, connector-required, and separate-stack states |
| Routing preference persists | `routing_policies` upsert contract and migration probe |
| Workstream handoff persists | `conversation_workstreams` insert/list contract and migration probe |
| Routing is owner-scoped | Clerk user email binds the list query and every created handoff |
| Automatic detection is not overstated | UI and README label it connector-dependent |
| Membership gates protected APIs | Clerk identity is resolved against active D1 membership |
| Admin surface is role-aware | Team access form renders only for owner/admin |

## Issues Found

- Initial test command used an older system Node runtime; validation was rerun with the workspace runtime required by the project.
- The restored Alpha branch had two strict TypeScript failures: an optional Clerk key and a missing attachment-download prop. Both are fixed.
- Clerk and model secrets remain production-only and are not checked into Git.
- PDF extraction emitted font-substitution warnings for some Chinese filings;
  every import completed, but representative search-result text should still be
  spot-checked in the owner session.

## Residual Risk

- Topics are free-text strings, not canonical entities.
- Scanned or image-only pages still require OCR.
- Connector and agent cards describe boundaries; no external system is connected.
- The dependency audit reports upstream package vulnerabilities that require a separate dependency-upgrade review.
- Nightly GitHub synchronization covers source and schema, not live D1/R2 records.
- The authenticated owner-session walkthrough remains a manual release check.

## V4.5 Event Knowledge Checks

| Check | Result | Notes |
|---|---|---|
| Seed integrity | Pass | 45 Events, 62 Claims, 106 typed links, 45 Team Notices |
| Verification migration | Pass | 13 Events partially verified; 17 Claims source verified |
| SQLite migration replay | Pass | 0009 → 0010 → 0011; counts reconcile and foreign-key check is clean |
| Privacy boundary | Pass | Raw WeChat messages excluded; Notices retain only sanitized week/channel metadata |
| API contract | Pass | Authenticated reads; owner/admin writes for Events, Claims, and Notices |
| UI contract | Pass | Event timeline and Claims inbox are separate; Event cards expose Claim/Notice counts |
| Responsive contract | Pass | Event workbench collapses to one column; evidence fields collapse on mobile |
| JSON validation | Pass | Taxonomy, Event, Claim, Notice, and verification files parse successfully |
| ESLint | Pass | No findings |
| TypeScript | Pass | Strict no-emit check |
| Production build | Pass | Event, Claim, and Notice routes included |
| Automated tests | Pass | 7/7 |

## V4.6 Demo IA and Readability Checks

| Check | Result | Notes |
|---|---|---|
| Navigation | Pass | Knowledge base, Report library, Event DB, Research Q&A, Settings; no separate Q&A History tab |
| Knowledge boundary | Pass | Knowledge base stores derived/saved knowledge; Report library is the indexed source-document layer |
| Event-card disclosure | Pass | Internal Metric, PM relevance, Evidence, Team Notice, and seed-file fields are absent |
| Date honesty | Pass | Only exact `YYYY-MM-DD` claim/event dates render; W30 and other coarse hints remain hidden |
| Source readability | Pass | Event cards show an attributed source statement without generated notice prose |
| Typography | Pass | Mixed Chinese/English Event and Claim content uses readable 13–18 px type with Times New Roman plus Chinese serif fallbacks |
| Tavily credential | Pass | Hosted secret configured; direct provider probe returned HTTP 200 and one result |
| Secret scan | Pass | Tavily secret absent from source and Git diff |
| Validation | Pass | ESLint, strict TypeScript, production build, and 7/7 tests |

Residual release check: authenticated owner-session interaction remains
dependent on the user's Clerk session after deployment.
