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

## V5.6 AskAI, sorting, members, and return-integrity QA delta

| Check | Result | Notes |
|---|---|---|
| Missing-return normalization | Pass | Every horizon without both date and close publishes null; the BBG `-1` placeholder can no longer render as `-100%` |
| July 23 Alphabet sample | Pass | T+0/T+1 retain real values; unavailable T+3/T+5 render as `—` |
| Speaker correction | Pass | All four New Hope Dairy Claim rows now identify Xu Lei |
| Event filters and sorting | Pass | Company and industry/theme are distinct; date, four horizons, drawdown, and upside support both directions with missing values last |
| AIDC sorting | Pass | IT MW, H100e, estimated cost, observation date, name, and owner are selectable; project-name ascending starts with Alibaba Zhangbei |
| AskAI navigation | Pass | Event DB and AI Capex expose one header action and no embedded bottom panel; the action opens the scoped unified AskAI workspace |
| Settings member management | Pass with signed-in dependency | Owner-only GET combines Clerk users and pending invitations; unauthenticated production access returns 401 |
| Desktop browser | Pass | Event filters, null returns, scoped AskAI navigation, AIDC sort, and Settings layout render locally |
| Mobile browser | Pass | 390 × 844 has no page-level horizontal overflow and keeps the contextual AskAI action visible |
| Automated validation | Pass | Lint, 20/20 tests, Claim/AIDC sync, and Tencent production build pass |
| Tencent production | Pass | Deployment `dpqyrxptxqbo`; canonical domain serves JS `index-Ckhec2pl.js` and corrected portable Claim JSON |

## V5.7 Privacy alias and Yahoo refresh QA delta

| Check | Result | Notes |
|---|---|---|
| Public privacy boundary | Pass | Published Claim JSON contains 16 `BossX` references and no `Xu Lei`; the four New Hope Dairy rows display `BossX` |
| Live market function | Pass | Production `/api/market-prices` returned 62 observed daily closes each for GOOGL and 0700.HK from Yahoo Finance |
| Return integrity | Pass | The client recalculates T+0/T+1/T+3/T+5 from observed trading sessions; missing horizons remain null and verified snapshots are the explicit fallback |
| Refresh and request bounds | Pass | Mapped symbols refresh every five minutes in batches of eight; the function validates symbols and permits at most ten per request |
| Local browser | Pass | Event DB shows `BossX`, contains no visible `Xu Lei`, preserves separated company/industry filters, and renders no `-100.0%` sentinel |
| Automated validation | Pass | Lint, Tencent production build, and 21/21 tests pass |
| Tencent production | Pass | Deployment `dpy1coemr2uo` completed in 29 seconds; `level-grind.com` serves JS `index-CdsZown2.js`, the aliased Claim JSON, and the Yahoo function |

## V5.8 Cross-database AskAI QA delta

| Check | Result | Notes |
|---|---|---|
| AI Capex filter density | Pass | Owner, country, and status remain; confidence and freshness are removed from the interactive filter row |
| Cross-database retrieval | Pass | Both launch scopes retrieve six ranked Event DB and six ranked AI Capex entries |
| Scope disclosure | Pass | Empty state and internal-data mode describe the two-library evidence boundary |
| Demo evidence | Pass | The tracked question guide uses current Claim and campus overlaps and states non-verifiable boundaries |
| Automated validation | Pass | Lint has no errors, 7/7 targeted tests pass, and the Tencent production build succeeds |
| Production release | Pass | Deployment `dpxzfw1jstlt` succeeded; `level-grind.com` serves JS `index-CoRPDsVF.js`, cross-library copy, and the simplified filter bundle |

## V5.10 AI Capex geocoding and AskAI Markdown QA delta

| Check | Result | Notes |
|---|---|---|
| China map coverage | Pass | All 3/3 China campuses have reproducible Nominatim place-level coordinates |
| Overall map coverage | Pass | Coverage improves from 51/75 to 54/75; the remaining 21 records stay explicitly unresolved |
| Data honesty | Pass | No building coordinate is inferred; place-level matches are labelled as such |
| AskAI Markdown | Pass | Assistant messages use the shared semantic Markdown renderer; user messages remain plain text |
| Answer hierarchy | Pass | Headings, bullets, links, citations, and bold emphasis have scoped research-chat styles |
| Automated validation | Pass | 7/7 targeted tests pass; lint has no errors and one unrelated existing warning; Tencent build succeeds |
| Release | Pending approval | No deployment or push performed in this task |

## V5.11 AI Capex location-evidence QA delta

| Check | Result | Notes |
|---|---|---|
| Evidence ordering | Pass | Script applies explicit Epoch/source coordinate, Satellite Explorer, reviewed parcel override, address geocoder, then labelled place centroid |
| Published coverage | Pass | 75/75 projects have finite coordinates and a directly supporting URL |
| Precision distribution | Pass | 9 explicit source coordinates; 66 Epoch Satellite Explorer campus locations; no place-level guess is currently needed |
| SAT40 traceability | Pass | Uses `29.4149522, -98.80304495` from the Google Earth link in the local Epoch timeline |
| Previously unresolved records | Pass | Prometheus, Osmium, Michigan, New Mexico, UAE, and the other prior gaps now resolve through Epoch spatial evidence |
| UI disclosure | Pass | Tooltip and project detail distinguish source coordinate, Epoch satellite, parcel, address, place-level, and unresolved states |
| Automated validation | Pass | 21/21 tests pass; targeted AIDC 4/4 passes; standard build and Tencent build pass |
| Lint | Pass with existing warning | No errors; one pre-existing unused import warning remains in `scripts/export-production-backup.mjs` |
| Browser gate | Partial | Local Tencent shell loads cleanly to the Clerk sign-in gate; authenticated post-login visual inspection is deferred because this candidate is not deployed |
| Release | Pending approval | No push or Tencent deployment performed |

## V5.13 Shared-persistence release candidate

| Check | Result | Notes |
|---|---|---|
| Database provisioning | Pass | Supabase free project is healthy in Singapore (`ap-southeast-1`); both reviewed migrations completed successfully |
| Secret boundary | Pass | Supabase URL and service-role key are masked Tencent EdgeOne server variables and absent from the repository |
| Shared Claim API | Pass | Clerk-authenticated GET/POST/DELETE, payload bounds, optimistic versions, `409` conflicts, audit rows, and read-only fail-closed behavior are implemented |
| Local takeover | Pass | Existing browser-local Claim overlays migrate once only when the shared row is absent; a timestamped backup is retained |
| Usage telemetry | Pass | DeepSeek attempts store user, model, thinking flag, tokens, web credits, latency, status, and server timestamp without full prompts |
| Member-manager parity | Pass | Owner and configured co-manager share list/invite/edit/remove authorization; protected managers cannot be removed through the UI |
| Database health | Pass | Service-role REST checks for Claim overlays and AI usage events both returned HTTP 200 |
| Automated validation | Pass | ESLint, 26/26 tests, portable Claim/AIDC publication, Tencent Vite build, and `git diff --check` pass |
| Two-user production check | Pending after deployment | Owner/Tiff cross-refresh verification requires the newly deployed EdgeOne functions and both physical Clerk sessions |
| Residual scope | Explicit | AskAI chat persistence, report/model object storage, automatic price jobs, and restore automation remain later increments |

### Production evidence

- Source commit `1f3472f` promoted through `feature/shared-persistence` to
  `main` and `production`.
- GitHub Actions run `30621461864` completed successfully; build, 26 tests,
  lint, and EdgeOne deployment all passed.
- `https://level-grind.com/` resolves to the canonical `www` site and returns
  HTTP 200 with `assets/index-DiSYN6qU.js`.
- `/api/shared-claims` returns HTTP 401 without a Clerk token, proving the new
  route is deployed and fail-closed.
- `/api/agent-chat` returns HTTP 200 with `deepseek-v4-flash`, DeepSeek/Tavily,
  and authentication-required metadata.
- Authenticated owner/co-manager cross-refresh remains the first company-device
  acceptance check; it is not represented as completed evidence.

## V5.19 AskAI provider-stream hotfix candidate

| Check | Result | Notes |
|---|---|---|
| Reported production failure | Reproduced by user | AskAI surfaced `Body is unusable: Body has already been read` before returning a model answer |
| Provider response handling | Fixed in candidate | Successful provider responses have exactly one direct reader; no cloned branch can buffer the generation |
| Compatibility fallback | Pass | If EdgeOne supplies an already-consumed or locked stream, AskAI retries once in non-streaming provider mode while SSE status/heartbeat remains live, then replays the answer through the client stream |
| Failure semantics | Pass | An unreadable stream has a typed error code and cannot surface the raw runtime exception or fail silently |
| Regression coverage | Pass | Behavioral tests cover fresh, consumed, and locked response bodies; the static contract rejects `response.clone()` |
| Automated validation | Pass | ESLint, 51/51 tests, `git diff --check`, and the portable Tencent build pass |
| Auth boundary | Pass | Anonymous Notes, Ideas, and AskAI-history probes remain fail-closed with HTTP 401 |
| Authenticated production smoke | Pending | Must be completed in the controlled canonical-domain Clerk session after hotfix deployment |
| Notes / Ideas read-back | Pending | Requires authenticated creation plus hard refresh; no production research record is created before that check |
## V5.20 — AskAI history hydration race (2026-08-05)

- Reproduced on authenticated production: provider reached `complete`, but a late private-history response replaced the optimistic chat and made the answer disappear.
- Added a local revision guard so history hydration/migration cannot overwrite a conversation started after hydration began.
- Token-by-token SSE updates now remain local; only the completed answer is queued for private cross-device persistence.
- Remote history writes are serialized to avoid version races between optimistic and completed snapshots.
- Clerk token callback identity changes no longer restart history hydration after a chat has begun.
- Chat visibility now follows the effective fallback project id; the initial default project no longer filters every newly-created chat out of the UI.
- Production Thinking-mode smoke testing exposed reasoning-token exhaustion before a final answer. Thinking requests now omit unsupported sampling temperature, set `reasoning_effort=high`, and reserve a separate 4,096–8,000 token completion budget.
- Verified with lint, 53/53 tests, portable EdgeOne build, and `git diff --check` under the bundled Node runtime.

## V5.21 — Authenticated production provider and persistence matrix (2026-08-05)

| Check | Result | Production evidence |
|---|---|---|
| DeepSeek Thinking | Pass | `deepseek-v4-flash` returned `deepseek-thinking-ok` with Thinking enabled; recorded provider latency 9.0s. The stream kept reasoning private and delivered the later visible `content`. |
| GPT-5.6 Sol | Pass | `openai/gpt-5.6-sol` returned `SOL-OK`; recorded latency 2.1s. |
| GPT-5.6 Terra | Pass | `openai/gpt-5.6-terra` returned `TERRA-OK`; recorded latency 1.7s. |
| GPT-5.6 Luna | Pass | `openai/gpt-5.6-luna` returned `LUNA-OK`; recorded latency 1.9s. |
| Claude Opus 4.8 | Pass | `anthropic/claude-opus-4.8` returned `OPUS48-OK`; recorded latency 2.4s. |
| Claude Fable 5 | Blocked by provider policy | OpenRouter returned `No endpoints available matching your guardrail restrictions and data policy`; the request reached OpenRouter and failed explicitly instead of timing out silently. |
| GLM-5.2 | Pass | `z-ai/glm-5.2` returned `GLM52-OK`; recorded latency 3.1s. |
| Kimi K3 | Pass | `moonshotai/kimi-k3` returned `KIMI3-OK`; recorded latency 3.5s. |
| Private AskAI history | Pass | After a full page reload, every successful marker above was restored once for the same Clerk account. |
| Shared Note lifecycle | Pass | Created a QA Note, received a server Note ID and v1 acknowledgement, reloaded it from the shared store, observed contribution count `Notes 1`, deleted it, and confirmed absence after reload. |
| Shared Idea lifecycle | Pass | Created a QA Idea, received a server Idea ID and v1 acknowledgement, loaded its AAPL hourly Yahoo validation card, reloaded it from the shared store, observed contribution count `Ideas 1`, deleted it, and confirmed absence after reload. |
| QA data cleanup | Pass | Both explicitly disposable QA records were removed and their absence was verified after reload. |

Code validation for this production pass: ESLint, 53/53 automated tests,
portable EdgeOne build, and `git diff --check` all passed. The remaining model
issue is configuration-specific: Fable 5 needs an OpenRouter endpoint whose
data policy matches the account guardrails, or it should be removed from the
visible allowlist until such an endpoint is available.

## V5.22 — Chat-level capture and two-tier research visibility candidate (2026-08-05)

| Check | Result | Evidence |
|---|---|---|
| Model picker | Pass | Fable 5 is absent from the reviewed fallback and UI picker; Sol, Terra, Luna, GPT-5.5, Opus 4.8, GLM-5.2, Kimi K3 and DeepSeek remain represented. |
| Answer actions | Pass | Each assistant answer exposes only `收藏` / `取消收藏`; per-answer download and Obsidian export were removed. |
| Chat actions | Pass | Chat header exposes whole-chat favourite, Markdown download and whole-history Obsidian export. |
| Personal Knowledge | Pass with release gate | Favourite answers and chats render as private Personal Knowledge entries. New favourites use the Clerk-subject AskAI history envelope for cross-device read-back; anonymous access remains fail-closed. |
| Raw Notes / Ideas visibility | Pass in contract tests | Configured owner/member managers can review all raw team records. Ordinary members receive only their own raw records. No email is hardcoded into the source. |
| Gray-box AskAI | Pass in contract tests | Team retrieval includes only records with `internalAiAllowed=true`; raw source records are not exposed through the ordinary list API. |
| Notes / Ideas attachment readiness | Not production-ready | UI and direct-upload protocol exist, but the authenticated local preview reports the team storage/upload service unavailable. TencentDB/COS/ingestion variables and an end-to-end upload/read-back must pass before uploads are opened to the team. |
| Automated validation | Pass | ESLint, 55/55 tests, portable Tencent build, and `git diff --check` pass. |
| Browser QA | Pass with backend limitation | Local preview confirms Fable removal, chat-level actions, Chat favourite appearing in Personal Knowledge, and fail-closed Notes/Ideas controls while the backend is unavailable. |
| Release | Pending approval | No commit, push, production configuration change, or deployment has been performed for V5.22. |

## V5.23 — Tencent attachment and gray-box production proof (2026-08-06)

| Check | Result | Production evidence |
|---|---|---|
| Notes persistence | Pass | Authenticated owner created two disposable synthetic Notes; refresh/read-back returned the same server IDs and versions. |
| COS direct upload | Pass | Markdown and PDF both received short-lived COS upload targets and completed without proxying file bytes through the browser API. |
| SCF parsing | Pass | Markdown and text-based PDF reached `解析完成 · v3`; the PDF preview rendered extracted text after refresh. |
| Ideas persistence | Pass | A disposable synthetic Idea, linked Note and parsed Markdown attachment survived production refresh/read-back. |
| Search indexing | Pass | New records default to internal gray-box indexing while external-AI and web-search permissions remain false. |
| AskAI retrieval | Pass | DeepSeek answered the unique synthetic phrase `orion-sparrow-4821` from the TencentDB blind-hash index in 4.3s without exposing the original Note title or owner in the model context. |
| Automated checks | Pass | 12/12 targeted attachment, UI, governance and storage-contract tests passed; portable Tencent build passed. |
| EdgeOne release | Pass | Deployment `dp0q2hmd0lqe` completed successfully and the canonical authenticated site loaded the updated Notes policy. |
| Raw-view role matrix | Pending second account | Owner production path passes; ordinary-member raw-list isolation still requires a second physical Clerk session. |
| Security boundary | Explicit | The production provider is external. Only synthetic/Public-safe data was used for this proof; real Internal/Confidential uploads remain subject to the external-model policy decision. |

## V5.24 — External-model policy gate and SCF runtime compatibility (2026-08-06)

| Check | Result | Production evidence |
|---|---|---|
| Retrieval metadata | Pass | SCF retrieval now returns sensitivity, external-AI permission and redaction-required metadata for Notes, Ideas and inherited attachments. |
| External-provider gate | Pass | EdgeOne sends private team context to DeepSeek/OpenRouter only when it is Public, or explicitly permits external AI and does not require redaction. |
| Negative privacy test | Pass | The Internal synthetic marker `orion-sparrow-4821`, with external AI disabled, was no longer returned to DeepSeek after deployment; the answer reported no matching internal record. |
| SCF architecture | Pass | Initial ARM image failure was detected by `/health`; image was rebuilt for Linux AMD64 and deployed as `20260806-6-amd64`. |
| SCF health/readiness | Pass | `/health` and `/ready` both returned HTTP 200; database and envelope encryption reported ready. |
| Notes read-back | Pass | The public disposable Note reloaded with two COS attachments; PDF and Markdown both remained `解析完成 · v3`, and the PDF text preview rendered. |
| Ideas read-back | Pass | The disposable Idea reloaded with its linked Note and parsed Markdown attachment. |
| EdgeOne release | Pass | Deployment `dp64p8eb3bjo` completed successfully and the canonical authenticated site loaded the updated provider gate. |
| Raw-view role matrix | Pending second account | Owner path passes; ordinary-member isolation still needs a separate Clerk session. |

## V5.25 — Upload-first intake, Idea Graph, and AIDC refresh (2026-08-07)

| Check | Result | Evidence |
|---|---|---|
| Notes/Ideas UX | Pass | Upload-first panels, first-record CTA, first-write celebration, compact toolbar, and non-overlapping PM review layout are present. |
| Mixed-company memo | Pass | Deterministic parser returns review-only candidates; unstructured prose produces none and no candidate silently becomes an Idea. |
| Attribution and roles | Pass | Source contributor is distinct from uploader; configured owner/manager upgrades are additive and Clerk identities/sessions are unchanged. |
| AskAI/navigation | Pass | AskAI is first; redundant heading copy is removed; chat has more vertical room. |
| Idea Graph | Pass | Full-width portable graph, filters, candidate warning, and node inspector render without a sibling-repo runtime import. |
| AIDC daily | Pass | Official source snapshot contains 77 campuses, 451 timeline rows, 221 site-chip-date rows, and 77/77 located campuses. |
| Private import | Prepared | Twelve supplied files are mapped in a private local manifest; dry-run verifies all files. Production execution is intentionally gated. |
| Automated validation | Pass | ESLint, 64/64 tests, Vite production build, importer syntax check, and `git diff --check` pass. |
| Browser QA | Pass | Desktop Ideas/Graph and mobile Notes were inspected; navigation, metadata, and responsive layout remain readable. |
| Release | Pending approval | No migration, Tiff file upload, commit, push, or deployment was performed in this increment. |

## V5.26 — Investment Graph parity and production model smoke (2026-08-07)

| Check | Result | Production evidence |
|---|---|---|
| Graph fidelity | Pass | The portable Idea Graph uses the sibling Investment Graph's three-column atlas, node inspector, relationship legend, zoom/fit/re-layout controls and daily evolution rail inside the Level Grind shell. |
| Multi-select | Pass | Production accepted simultaneous `AI硬件 + 汽车` industry filters and the `美股` market filter. |
| Daily evolution | Pass | The 2026-08-03—2026-08-06 slider and playback control render on the canonical site. |
| DeepSeek | Pass | `deepseek-v4-flash` returned `OK`; provider latency shown by the production UI was 6.7s. |
| OpenRouter Sol | Pass | `openai/gpt-5.6-sol` returned `OK`; provider latency 1.8s. |
| OpenRouter Terra | Pass | `openai/gpt-5.6-terra` returned `OK`; provider latency 1.3s. |
| OpenRouter Luna | Pass | `openai/gpt-5.6-luna` returned `OK`; provider latency 1.4s. |
| OpenRouter GPT-5.5 | Pass | `openai/gpt-5.5` returned `OK`; provider latency 1.7s. |
| OpenRouter Opus 4.8 | Pass | `anthropic/claude-opus-4.8` returned `OK`; provider latency 1.4s. |
| OpenRouter GLM-5.2 | Pass | `z-ai/glm-5.2` returned `OK`; provider latency 0.9s. |
| OpenRouter Kimi K3 | Pass | `moonshotai/kimi-k3` returned `OK`; provider latency 2.6s. |
| Current AIDC snapshot | Pass | The refreshed Epoch source now contains 75 campuses and all 75 have a publishable map position; regression checks follow the live source rather than a stale fixed count. |
| Automated validation | Pass | ESLint, 65/65 tests, the portable EdgeOne build and `git diff --check` passed. |
| Release | Pass | GitHub Actions run `31148679855` deployed commit `f18cda4` from `production` to the canonical EdgeOne site. |
