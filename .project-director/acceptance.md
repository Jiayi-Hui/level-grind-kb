# Acceptance — Research OS Alpha

## Delivered foundation

- [x] Clerk authentication plus D1 owner/admin/member authorization.
- [x] Shared R2 report storage and D1 page-level searchable text.
- [x] 30 CNINFO reports covering 15 companies and 6,237 pages in production.
- [x] Server-side DeepSeek adapter with per-user tokens, cost, latency, and status.
- [x] Owner/admin team usage view.
- [x] 25 MB interactive upload and chunked controlled corpus import.

## Current increment

- [x] Model Markdown renders as formatted text without visible `**` markers.
- [x] Chinese/English switching is available in the top bar and Settings.
- [x] Language persists per user.
- [x] A per-session Welcome back banner describes current changes.
- [x] Conversation routing is removed from the product UI and API surface.
- [x] Personal, team, and task context pages are removed from the sidebar.
- [x] Low-frequency research-profile controls are available in Settings.
- [x] Settings shows personal storage used, remaining, and quota.
- [x] Report Q&A history persists and reopens after refresh.
- [x] Q&A history is contained inside Research Q&A rather than duplicated in
  the main sidebar.
- [x] Personal Knowledge and Report library have distinct user-facing definitions.
- [x] History exports Markdown and opens the Obsidian URI handoff.
- [x] Reports open in a new tab immediately with visible progress feedback.
- [x] Obsidian export can target the currently open vault without inventing a
  default vault name.
- [x] Research Q&A shows a spinner and elapsed waiting time without exposing
  hidden reasoning.
- [x] Report, Web, and Hybrid evidence modes exist.
- [x] Unconfigured web search fails honestly with a setup message.
- [x] Web results can be selected and saved with provenance into the knowledge base.
- [x] Responsive loading, empty, error, success, and disabled states are present.
- [x] Lint, typecheck, tests, build, hosted deployment, and GitHub push pass.

## Planned product acceptance

- [ ] Persona onboarding supports PM, JEM PM, Analyst, and named other users.
- [ ] Personal quota enforcement and owner-managed allocation are implemented.
- [ ] Hybrid semantic/vector retrieval is production-ready.
- [ ] Company Azure gateway is approved and reachable from the public app.
- [ ] Additional filing-source adapters are validated.
- [x] Model Workbench phase one registers existing Excel models, source-linked
  inputs, owners, versions, freshness, review state, and comparable outputs.
- [x] Contextual “Ask about this” launchers hand Personal Knowledge, Report, and
  Event scope to the canonical Research Q&A history.

## V4.8 Unified Research and Model Operations

- [x] Research Q&A has fixed-height Projects, Chats, and message scroll regions.
- [x] Existing research projects can be renamed through the authenticated API.
- [x] Global search categorizes matching Personal Knowledge, reports, and events.
- [x] Report Library filters by company, sector, report type, and year.
- [x] Event DB pivots by event type, company, quarter, and sector.
- [x] Event provenance displays WeChat Group, actual speaker, and supplied
  verification provider without invented labels.
- [x] “Ask about this” launchers converge into one Research Q&A history.
- [x] Model Workbench uploads, registers, maps, reviews, audits, and exports
  Excel workbooks.
- [x] The sample Excel contains readable input, formula, output, source,
  update-queue, and change-log sheets.
- [x] Mobile breakpoints keep navigation, filters, cards, chat, and model tables
  usable without allowing long content to stretch the page.

## V4.9 Brand and Provider Operations

- [x] The user-selected rising-arrow mark is cleaned into a transparent,
  watermark-free project asset and used in navigation, authentication, favicon,
  Apple icon, and PWA metadata.
- [x] DeepSeek and Tavily retain honest live connection states.
- [x] Owner/admin settings show the supplied 2026-07-28 provider-console
  snapshots without presenting them as real-time API data.
- [x] DeepSeek workspace-recorded requests, tokens, and estimated cost remain
  live D1 aggregates and are visibly separated from the console snapshot.
- [x] Tavily shows 3 / 1,000 free credits, 997 remaining, and pay-as-you-go off.

## Event knowledge increment

- [x] Events, Claims, Claim–Event relations, and Team Notices are separate D1
  objects.
- [x] Existing Event ids and fields remain compatible.
- [x] Source verification and Event verification use independent statuses.
- [x] Dymon/BBG evidence is retained as Claims rather than overwriting the
  originating candidate.
- [x] Event timeline links Events to attributed source statements.
- [x] Claims inbox shows type, source, confidence, status, relation, and linked
  Event ids.
- [x] Raw WeChat text is excluded from tracked seed data.
- [x] Desktop and mobile layouts retain usable Event/Claim views.
- [x] Event cards omit internal-model labels, coarse week labels, generated
  notice prose, and seed filenames.
- [x] Event and Claim typography is readable for mixed Chinese/English content.

## V5.0 PM Event Research Demo

- [x] Level Grind contains the validated 10-event / 410-security research
  snapshot from event-db.
- [x] Cross-event search covers event narrative, trigger, company name, ticker,
  and related industry; event type, company, primary industry, and quarter
  filters compose.
- [x] Selecting a company switches event-return metrics to that security rather
  than merely filtering the event list.
- [x] Industry filtering uses each event's primary affected industry rather
  than matching every industry represented in the underlying snapshot.
- [x] Selected events show T+1, T+5, T+20, drawdown, breadth, price path,
  benchmark-relative path, sector dispersion, securities, and sources.
- [x] Investment read-throughs distinguish demand deterioration, policy damage,
  intact demand/crowding, and insufficient-evidence states.
- [x] Claim Inbox uses a server-only secret and idempotent WeChat message ids.
- [x] Event and Claim state refreshes every three seconds while the Event DB is
  visible.
- [x] Hosted Claim Inbox secret is configured and rejects unauthorized calls;
  an authorized validation request reaches schema validation without writing
  test data.
- [x] `level-grind.com` routes over HTTPS to the protected Sites deployment.
- [ ] One real WeChat → Codex → D1 round-trip is captured as delivery evidence.
- [ ] Hong Kong no-VPN access is verified on the PM's physical device.
- [ ] Mainland access remains outside tomorrow's acceptance scope; the tested
  EdgeOne reverse-proxy origin returned 403 and is not used for production.

## V5.1 AI Capex Dashboard

- [x] AI Capex is a peer left-panel and mobile navigation item between Event DB
  and Model Workbench.
- [x] A repeatable sync emits versioned, checksummed portable JSON to tracked
  data and public runtime folders without a browser/runtime sibling-repo
  dependency.
- [x] The snapshot preserves 75 campuses, 424 timeline records, 205
  site-chip-date records, 176 hardware records, and exact source lineage.
- [x] KPI, owner comparison, buildout timeline, status pipeline, project
  matrix, project detail, and Sources & Freshness views render.
- [x] Owner, country, status, confidence, and freshness filters compose.
- [x] Every chart/KPI/material conclusion carries metric-specific sources,
  observation date, data cutoff, sync time, and methodology.
- [x] Historical/current records and Epoch baseline plans are visually distinct;
  no unsupported p10/p50/p90, delay, building-stage, or Capex Momentum data is
  invented.
- [x] Loading, error, empty, partial-data, and stale states are complete.
- [x] English/Chinese desktop and mobile browser checks pass without clipping,
  overflow, empty charts, or hidden source references.
- [x] Targeted tests, lint, and production build pass.

## V5.2 Tencent Hong Kong Continuity

- [x] The Tencent deployment serves Event Research and AI Capex without
  requesting or redirecting to `chatgpt.site`.
- [x] The published bundle contains the current event and AIDC JSON assets.
- [x] Disabled dynamic modules are visibly marked as migrating and expose no
  dead write controls.
- [x] `level-grind.com` redirects to the Tencent-hosted canonical domain;
  `www.level-grind.com` is Effective with a deployed managed certificate.
- [x] Homepage, Event Research JSON, and AI Capex JSON return HTTP 200 from
  EdgeOne Pages and fresh browser navigation contains no `chatgpt.site` URL.
- [ ] A physical Hong Kong phone opens the apex domain with VPN disabled.
- [ ] Full authenticated D1/R2-backed functionality is not considered
  migrated until the write runtime and backups have been imported and tested.

## V5.3 Real Claim Ledger and Clerk

- [x] Event DB runtime data comes from the 45 real group-chat Claims rather
  than the 10-event narrative prototype.
- [x] The portable snapshot contains 88 BBG-derived Claim–security mappings and
  48/48 public price series.
- [x] Claim text, speaker, HKT time, date-evidence quality, effective period,
  and content-verification state remain separate.
- [x] Security event windows show T+0/T+1/T+3/T+5 return and abnormal return.
- [x] Dymon/BBG findings render as attributed evidence; a price window never
  marks Claim content verified.
- [x] Generated investment-read-through, similarity, shock, and demand-state
  prose is removed from the Event DB.
- [x] Search, source-status filtering, speaker filtering, security mapping
  filtering, and up-to-four-Claim comparison are implemented.
- [x] AI Capex evidence metadata is compact while source, observation date,
  cutoff, sync time, and method remain available.
- [x] The existing Clerk client gates the Tencent continuity UI.
- [ ] Tencent server-side authorization for static research JSON is not claimed
  until data is moved behind an authenticated Tencent runtime.
- [ ] Physical Hong Kong phone sign-in and signed-in navigation are verified.

## V5.4 Dense research screens

- [x] Event DB landing surface is a compact Claim/T+X table with search and
  company, speaker, and ticker filters.
- [x] Claim rows can be added, edited, and deleted on the current device.
- [x] Claim detail shows the published real price path and highlighted event
  windows without investment advice.
- [x] AI Capex KPI evidence paragraphs are replaced by one compact dataset note.
- [x] The project matrix precedes a bundled world map and visual project detail.
- [x] Unresolved AIDC coordinates remain absent rather than fabricated.
- [x] Settings contains a Clerk-backed invitation form with Analyst, PM, and
  GEM PM roles.
- [x] Tencent environment contains masked `CLERK_SECRET_KEY` and owner email;
  the live invitation endpoint rejects unauthenticated access.
- [ ] A real invitation email round trip awaits the first boss email entered by
  the signed-in owner; no unsolicited test invitation was sent.
