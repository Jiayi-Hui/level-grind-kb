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

## V5.0 PM Event Research Demo Checks

| Check | Result | Notes |
|---|---|---|
| Historical snapshot | Pass | 10 events, 410 security returns, 182 price paths, and 31 attributed sources |
| Multidimensional discovery | Pass | Search plus event type, company, primary industry, and quarter filters |
| Company metric semantics | Pass | Selecting a security switches T+1/T+5/T+20 and event-index values to that security |
| Industry semantics | Pass | Primary affected industry is derived from the largest absolute first-day industry reaction |
| Price reaction | Pass | Numeric returns, security table, aggregate event path, benchmark-relative path, and dispersion are visible |
| Investment read-through | Pass | Deterministic states distinguish deterioration, policy damage, crowding/intact demand, and insufficient evidence |
| Live Claim provenance | Pass | Exact timestamp, WeChat Group source, and speaker display only when present |
| Claim security | Pass | Server-only secret rejects unauthorized requests; authorized empty payload reaches validation without a database write |
| Automated validation | Pass | Production build and 13/13 focused tests pass |
| Custom domain | Pass | `level-grind.com` returns HTTPS 200 and protected APIs remain authenticated |
| Real connector round-trip | Pending | Requires one actual message through the existing company-side WeChat/Codex bridge |
| PM device access | Pending | Requires a no-VPN check on the PM's physical Hong Kong device |

## V5.1 AI Capex Dashboard Checks

| Check | Result | Notes |
|---|---|---|
| Portable research snapshot | Pass | `aidc-capex.v1` contains schema/model versions, generated/synced/cutoff dates, input snapshots, record counts, and SHA-256 checksums |
| Research record integrity | Pass | 75 campuses, 424 timeline rows, 205 site-chip-date rows, 176 hardware rows, 143 chiller rows, 527 cooling-tower rows, and 899 chip-owner rows |
| Source lineage | Pass | 296 numbered records retain publisher, exact title, source/observation/access dates when supplied, rights, verification, and exact URL or asset id |
| Runtime independence | Pass | Browser reads generated JSON only; the sibling research repository is needed only when explicitly re-running the sync |
| Navigation and localization | Pass | AI Capex is between Event DB and Model Workbench in desktop/mobile navigation; English and Chinese labels/headings are present |
| Decision views | Pass | Six KPIs, owner capacity, status/freshness, capacity timeline, project matrix, project detail charts, milestones, methods, and source ledger render |
| Evidence honesty | Pass | Historical/current data is solid green; future Epoch baseline is dashed/amber; unavailable reviewed forecasts and Capex Momentum are explicitly marked research-pilot gaps |
| Interaction | Pass | Owner metric toggles, owner/country/status/confidence/freshness filters, and project selection were exercised in the browser |
| Responsive desktop | Pass | 1280 × 720 review showed no page-level horizontal overflow; charts had non-zero dimensions and wide evidence tables scroll within their panels |
| Responsive mobile | Pass | 390 × 844 review showed no page-level horizontal overflow; KPI cards stack and wide project/source tables retain local horizontal scrolling |
| State coverage | Pass | Loading, error/retry, empty-filter, partial-data, stale, unknown, and chart-empty states are implemented |
| Automated validation | Pass | 17/17 tests, lint, and production build pass; lint retains one unrelated pre-existing warning in `scripts/export-production-backup.mjs` |

The browser review used a development-only visual harness because local Clerk
credentials are intentionally absent. The harness was removed before delivery;
the production AI Capex view remains integrated in the authenticated
`ResearchWorkspace` switch. No deployment or push was performed.

## V5.2 Tencent Hong Kong Continuity Checks

| Check | Result | Notes |
|---|---|---|
| Failure isolation | Pass | Direct Sites and EdgeOne-to-Sites both retained a blocked `chatgpt.site` upstream; authentication was not the cause |
| Tencent-native bundle | Pass | Event Research and AI Capex components load their published JSON from the EdgeOne Pages deployment |
| Honest feature boundary | Pass | Knowledge, reports, AskAI, Model Workbench, authentication, and writes are disabled and marked `迁移中` |
| Latest deployment | Pass | Production deployment `dpow9ya5eggq` completed successfully in 18 seconds |
| Custom domain | Pass | `www.level-grind.com` is Effective; Tencent free certificate is Deployed with automatic renewal |
| Share URL | Pass | Fresh `level-grind.com` navigation reaches the Tencent-hosted Research OS and contains no `chatgpt.site` URL |
| Core data paths | Pass | Homepage, `/data/event-research.json`, and `/data/aidc-capex/dashboard.json` return HTTP 200 |
| Browser interaction | Pass | Event Research renders ten events and AI Capex renders the 75-campus baseline from Tencent-hosted assets |
| Automated validation | Pass | Lint has zero errors and one unrelated existing warning; 17/17 tests, full build, and continuity build pass |
| Physical Hong Kong phone | Pending user confirmation | DNS and HTTPS are effective; final carrier-specific validation must be performed on the user's phone with VPN disabled |

## V5.3 Real Claim Ledger and Tencent Clerk Checks

| Check | Result | Notes |
|---|---|---|
| Real Claim source | Pass | 45 normalized group-chat Claims, including 25 with original timestamps |
| Price mapping | Pass | 88 BBG-derived Claim–security mappings and 48/48 public price series |
| Evidence boundary | Pass | Claim content status, timestamp quality, security mapping, BBG window, public cross-check, and Dymon evidence remain independent |
| Event interaction | Pass | Search, speaker/evidence/mapping filters, claim selection, security selection, and four-Claim comparison render |
| AI prose removal | Pass | No generated similarity, shock, demand-state, or investment-read-through copy remains |
| AI Capex density | Pass | Short labels replace explanatory prose; source, observation, cutoff, sync, and collapsible method remain attached to each decision view |
| Desktop browser | Pass | Claim ledger and AI Capex render in the Tencent continuity shell without clipping |
| Mobile browser | Pass | 390 × 844 navigation, KPI stack, filters, Claim list, and AI Capex evidence render without page-level overflow |
| Clerk client gate | Pass | Production build restores the Clerk session, shows the invited-account gate, and loads the Google/Microsoft/GitHub/email sign-in modal |
| Static-data boundary | Explicit | Clerk protects the rendered UI; static JSON is not represented as server-authorized |
| Automated validation | Pass | 17/17 tests, full build, Tencent build, and lint with one unrelated pre-existing warning |
| Tencent production | Pass | Deployment `dpjgwih2iu3d`; `www.level-grind.com` serves the new asset hashes and Claim ledger cutoff `2026-07-28` |
| Physical Hong Kong sign-in | Pending user confirmation | Carrier-specific no-VPN and actual invited-account sign-in remain physical-device checks |

## V5.4 QA delta

| Check | Result | Notes |
|---|---|---|
| Event density | Pass | Claim table leads; fixed interpretation and recommendation prose removed |
| Price integrity | Pass | Charts use the 48 tracked AKShare/yfinance public series paired with BBG event horizons |
| Claim actions | Pass with boundary | Add/edit/delete persist in browser storage; shared multi-user persistence is not claimed |
| AIDC density | Pass | Compact KPI snapshot flows directly into matrix, filters, map, and detail |
| Map integrity | Pass | 51/75 Nominatim address/place results plot; 24 unresolved projects do not render |
| Image rights | Pass | No Epoch-referenced third-party satellite image is copied; original links remain available |
| Clerk invitation | Production-ready | Tencent stores masked Clerk secret and owner email; unauthenticated production API correctly returns 401 |
| Tencent production | Pass | Deployment `dpol6z9tc8tl`; new JS/CSS hashes, geocode asset, and Cloud Function are live |

## V5.5 Agentic research QA delta

| Check | Result | Notes |
|---|---|---|
| Scoped research | Pass | Event DB and AI Capex each rank and send only their own current-module records |
| Provider boundary | Pass with configuration dependency | Tencent stores Tavily plus DeepSeek base/model/output settings server-side; the DeepSeek secret still requires a one-time console login |
| Authentication | Pass | POST verifies the Clerk JWT before search or model calls; GET health is intentionally non-sensitive |
| Research modes | Pass | Hybrid, Current module, and Web modes have distinct evidence behavior |
| Chat ergonomics | Pass | Fixed 720px workbench, independently scrollable message history, elapsed thinking time, and bounded project/chat lists |
| Project and chat lifecycle | Pass | Create, rename, and confirmed delete persist on the current device |
| Answer portability | Pass | Save to Personal Knowledge, Markdown download, and Obsidian deep-link export are implemented |
| Honest boundaries | Pass | Report Library, Model Workbench, and unified AskAI are disabled and marked `待上线`; missing provider configuration returns an explicit error |
| Automated validation | Pass | Lint, Tencent production build, and 20/20 targeted tests pass |
| Desktop browser | Pass | Event data, AI Capex data, both embedded chat panels, and Personal Knowledge were exercised locally |
| Tencent function | Pass | Deployment `dph9nmikv34j` succeeded; production GET `/api/agent-chat` returns the expected health document |
| Provider configuration | Pass | DeepSeek and Tavily keys plus model/runtime settings are stored as masked Tencent environment variables |
| Signed-in answer | Pending physical session | Production remains at the Clerk sign-in gate in the controlled browser; one signed-in prompt is the final end-to-end user check |
