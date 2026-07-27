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

## V4.7 Experience Checks

| Check | Result | Notes |
|---|---|---|
| Obsidian current-vault handoff | Pending release | Blank vault omits the URI `vault` parameter; legacy invented default is migrated away |
| Vault-setting clarity | Pending release | Copy distinguishes saving a local preference from opening Obsidian |
| Report opening feedback | Pending release | Source card and immediately opened destination tab show indeterminate progress |
| Research waiting feedback | Pending release | Spinner and elapsed seconds appear; hidden model reasoning is not rendered |
| Personal Knowledge label | Pending release | Chinese navigation and heading use “个人知识库” |
| Pilot access boundary | Pass | Hosted allowlist contains one company-email pilot; no team invitations were sent |
| Model Workbench direction | Pass | Decision is hybrid Excel-first; no empty navigation shell was added |

## V4.8 Unified Research and Model Operations Checks

| Check | Result | Notes |
|---|---|---|
| Chat containment | Pass | Desktop and phone CSS bound the shell; Projects, Chats, and messages scroll independently |
| Project rename | Pass | Owner-scoped PATCH updates project title without changing conversation ids |
| Cross-library search | Pass | Knowledge, report, and event results are categorized and route to the owning surface |
| Library filters | Pass | Reports filter by company, sector, type, and year; Events pivot by type, company, quarter, and sector |
| Provenance honesty | Pass | WeChat Group is a source label; speaker and verification provider render only from stored data |
| Unified Q&A | Pass | Context launchers prefill one Research Q&A; hybrid retrieval includes knowledge, report pages, events, and web |
| Workbook template | Pass | Seven rendered sheets inspected; formulas calculate revenue, EBIT, margin, EPS, equity value, and per-share value |
| Workbook formula scan | Pass | No formula-error tokens found in the generated workbook |
| Model persistence | Pass | Workbook bytes use R2; registry, variables, review queue, and change history use D1 |
| Update safety | Pass | Source scans create review candidates with blank proposed values; analyst confirmation is required before writeback |
| Dependency boundary | Pass | Narrow `fflate` parser avoids adding a vulnerable full spreadsheet runtime to the browser bundle |
| Automated validation | Pass | ESLint, strict TypeScript, production build, and 8/8 tests |
| Production deployment | Pass | Saved Sites version 15 deployed successfully from validated commit `82e8f21` |
| Anonymous access boundary | Pass | Published site renders its Clerk sign-in gate without exposing workspace content |
| Custom domain attachment | Pending DNS | `level-grind.com` is registered with the site; apex and validation records still need to be added at the DNS provider |

## V4.9 Brand and Provider Operations Checks

| Check | Result | Notes |
|---|---|---|
| Logo extraction | Pass | Transparent RGBA logo has transparent corners, preserved green/gold mark, and no source watermark |
| Brand surfaces | Pass | Sidebar, auth gate, favicon metadata, Apple icon, and PWA manifest use the PNG asset |
| Snapshot honesty | Pass | DeepSeek/Tavily figures are dated and labeled manual console snapshots |
| Live usage boundary | Pass | Workspace query/token/cost totals still come from authenticated D1 aggregates |
| Admin boundary | Pass | Provider balances and quota snapshots render only for owner/admin users |
| Responsive quota layout | Pass | Five DeepSeek metrics collapse to two columns at phone widths |

Pending release check: authenticated desktop and phone walkthrough requires the
user's Clerk session. Localhost intentionally fails closed without its public
key, and the shared in-app browser correctly reached the production sign-in
gate but did not have an authenticated account.
