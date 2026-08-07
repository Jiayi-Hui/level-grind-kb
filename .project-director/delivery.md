# Delivery — Research OS Alpha

## Summary

Level Grind Research OS Alpha is live in production. The current experience is
organized around Knowledge base, Report library, Event DB, Research Q&A, and
Settings, with Clerk authentication and persistent D1 team membership,
owner/admin/member roles, and suspension enforcement. Q&A history now stays
inside the Research Q&A project/conversation view.

The V4 storage increment is now published. Report PDFs use the hosted R2
`FILES` binding; report metadata, extracted page text, and per-user AI usage use
the hosted D1 `DB` binding. The report assistant can switch among DeepSeek,
GLM, and Kimi using server-side runtime settings.

The first CNINFO production corpus is live: 30 annual and half-year reports
covering 15 A-share companies and 6,237 PDF pages were imported and then
rechecked idempotently.
Interactive admin uploads now accept PDFs up to 25 MB. The bootstrap importer
uses chunked file and page-text writes for larger documents; its temporary
production credential was removed after the batch completed.

The Research OS experience increment replaces the context-heavy navigation with
five repeated-use surfaces: Knowledge base, Report library, Event DB, Research
Q&A, and Settings. It adds account-persisted Chinese/English localization,
per-login release notes, formatted Markdown answers, private query history,
Obsidian export, personal storage visibility, faster report opening feedback,
and explicit Report/Web/Hybrid evidence modes.

## Changed Areas

- Context-aware capture and search.
- Personal research context.
- Team topic and provenance view.
- Task context packs.
- System-boundary view.
- Additive D1 context schema.
- Server-side personal/team visibility enforcement.
- Updated product and architecture documentation.
- Clerk-protected routing API.
- Personal routing policy and owner-scoped workstream register.
- Manual handoff builder with explicit automatic-detection boundary.
- Fail-closed invitation allowlist and clear missing-Clerk configuration state.
- Owner bootstrap plus persistent member and role administration.
- Admin PDF ingestion with source metadata and idempotent imports.
- Searchable page chunks and citation-bearing report answers.
- Per-user query, token, estimated-cost, latency, and status records.
- Provider-neutral DeepSeek/GLM/Kimi server boundary.
- Per-answer output hard cap to bound pilot cost and latency.
- Whole-product PRD and status matrix.
- Safe Markdown answer rendering.
- Private per-user research-query history.
- Language and storage-preference API.
- Selective public-web evidence capture.
- Settings-based profile, quota, Obsidian, integration, and team controls.
- Removed Conversation routing UI/API and the three context navigation items.
- Removed the duplicate Q&A History navigation item.
- Defined Report library as the source-document layer of the Knowledge base.
- Simplified Event cards to event, company/ticker, exact known date,
  verification status, and an attributed source statement.
- Hid coarse week labels, seed filenames, generated Team Notice prose, and
  internal Metric/PM/Evidence fields from the demo UI.
- Configured Tavily as the hosted public-web search provider without committing
  its secret.

## Verification

- Typecheck, lint, build, 7/7 automated tests, migration inspection,
  unauthorized API probes, and local persistence probes passed.
- Production version 11 is live. The homepage returns the new Research OS and
  protected APIs correctly reject anonymous requests after edge propagation.
- The validated source commit and this release record are pushed to GitHub on
  `add-clerk-auth-alpha`.

## Known Limitations

- Gmail/Clerk sign-in still needs a final owner-session walkthrough on the
  user's device.
- Retrieval is keyword-grounded in this Alpha; embeddings and hybrid/vector
  ranking are a later quality layer.
- Web and Hybrid modes use a server-side Tavily key; DeepSeek performs
  synthesis and does not receive the key.
- Scanned/image-only PDFs still require OCR.
- No external chat connector, knowledge graph, or autonomous agent execution.
- No two-way Obsidian sync or Excel runner.
- No Quant research computation in the web application.
- Automatic topic-shift detection needs an approved chat-history connector.
- GitHub sync moves source and schemas, not D1/R2 content.

## Follow-Up

1. Complete the Gmail owner-session walkthrough and persona onboarding.
2. Ask one production report question and verify citations plus usage metering.
3. Test one Web/Hybrid question with the hosted Tavily integration.
4. Add owner-managed quota allocation and hard quota enforcement.
5. Build governed Obsidian and company-AVD connectors.

## V4.7 Release Candidate

- Personal Knowledge replaces the generic Knowledge base label.
- Obsidian no longer assumes a vault named `Research`; a blank setting targets
  the vault currently open in Obsidian.
- Report opening now has visible progress in both the report card and the newly
  opened tab.
- Research Q&A shows elapsed waiting time without displaying hidden reasoning.
- One company-email pilot is allowlisted for login testing; no other team
  accounts have been added or invited.
- Model research supports an Excel-first Model Workbench: govern and automate
  existing workbooks first, then extract typed inputs, outputs, and repeatable
  calculations for later quantitative workflows.

## V4.8 Release Candidate

- Research Q&A is a bounded workspace: Projects, Chats, and the conversation
  scroll independently, and projects can be renamed.
- Global search spans Personal Knowledge, Report Library, and Event DB.
- Reports and Events can be filtered from multiple investment-research
  dimensions without changing the underlying records.
- Event cards identify WeChat Group, the actual speaker, and the verification
  source only when those values exist.
- “Ask about this” from a knowledge item, report, or event hands context into a
  single Research Q&A history.
- Model Workbench registers Excel files, maps standard inputs/calculations/
  outputs, records owners and versions, surfaces stale inputs and source-linked
  review candidates, preserves a change log, and exports approved values.
- Excel remains the authoritative formula engine. The web application does not
  pretend to execute arbitrary workbook logic.
- Sites version 15 was published from validated commit `82e8f21`.
- `level-grind.com` is attached to the site and awaits apex/ownership DNS
  validation before it can route traffic.

## V4.9 Release Candidate

- Replaces the lettermark with the supplied rising-arrow and gold-spark logo
  across the authenticated workspace, sign-in gate, favicon, and PWA.
- Adds owner/admin operational snapshots for DeepSeek balance and consumption
  plus Tavily free-credit usage.
- Keeps dated console snapshots separate from the application's live D1 usage
  ledger so stale provider numbers are never presented as real-time readings.

## V5.0 PM Event Research Demo

- Integrates the validated event-db snapshot: 10 events, 410 security returns,
  182 price paths, and 31 attributed sources.
- Adds cross-event search and event type, company, primary industry, and quarter
  filters. Company selection changes the displayed return metrics; industry
  filtering uses the event's primary affected industry.
- Shows T+1/T+5/T+20 moves, drawdown, breadth, aggregate and
  benchmark-relative paths, security-level reactions, industry dispersion, and
  source evidence.
- Generates deterministic investment read-throughs without presenting them as
  trading instructions or model-generated facts.
- Adds a secret-protected, idempotent Claim Inbox endpoint and three-second
  Event/Claim refresh while the Event DB is visible.
- Live Claim rows state the source as WeChat Group and name the speaker only
  when that provenance exists.
- `level-grind.com` routes directly to the protected Sites deployment over
  HTTPS. The failed EdgeOne reverse-proxy path is not used in production.
- Production release evidence includes a successful build, 13/13 tests,
  unauthorized and authorized-validation Claim API probes, and domain health.
- Two physical checks remain explicit: one real WeChat/Codex/D1 round-trip and
  one no-VPN visit from the PM's Hong Kong device.

## V5.1 AI Capex Dashboard

- Adds AI Capex as a first-class Level Grind workspace beside Event DB and
  Model Workbench, including bilingual labels and the existing mobile
  navigation path.
- Adds a repeatable research-to-product sync that emits tracked, publishable,
  checksummed JSON and can fall back to the committed snapshot when the sibling
  research repository is unavailable.
- Preserves the reviewed Epoch dataset boundary: 75 campuses, 424 timeline
  rows, 205 site-chip-date rows, 176 hardware rows, supporting cooling/chip
  datasets, and 296 exact source records.
- Delivers source-attributed KPI, owner capacity, status/freshness, historical
  versus planned capacity, project screening, project detail, milestone, method,
  and source-ledger views.
- Separates observation date, source date, research cutoff, and Level Grind
  sync time. Freshness is calculated from observation date, never from import
  time.
- Does not invent reviewed p10/p50/p90 forecasts, building-stage status, delay
  probabilities, next-four-quarter building MW, or company Capex Momentum.
- Browser review passed at 1280 × 720 and 390 × 844 with no page-level
  horizontal overflow; interaction and stale-data filtering were exercised.
- Final validation: 17/17 tests, lint, production build, and diff hygiene pass.
- Delivery is a local commit only. It is intentionally not pushed or deployed
  until user confirmation.

## V5.2 Tencent Hong Kong Continuity

- The previous direct Sites domain and the EdgeOne-to-Sites reverse proxy both
  retain `chatgpt.site` in the request path and cannot satisfy the verified
  Hong Kong no-VPN requirement.
- `deploy/edgeone-demo` now builds a standalone Tencent-hostable surface from
  the real Event Research and AI Capex components and published JSON.
- Tencent project `level-grind-hk-demo` (`makers-izlj942dw6n9`) deployed
  successfully in 17 seconds and rendered both modules from Tencent-hosted
  assets.
- `www.level-grind.com` is the Tencent-hosted canonical domain. Cloudflare
  terminates and redirects the apex so users can continue sharing
  `level-grind.com`; neither route uses a Sites origin.
- Final deployment `dpow9ya5eggq` succeeded in 18 seconds. Tencent reports the
  custom domain Effective and the free certificate Deployed; homepage and both
  published research JSON paths returned HTTP 200.
- The continuity surface intentionally disables authentication and write
  modules instead of presenting nonfunctional controls. Full D1/R2, report,
  knowledge, AskAI, Model Workbench, and Claim Inbox migration remains a
  separate full-stack phase.
- Exact operating and rollback instructions are in
  `docs/TENCENT_EDGEONE_HANDOFF_2026-07-30.md`.

## V5.3 Real Claim Ledger and Tencent Clerk Gate

- Replaces the ten-event narrative demo on the Tencent surface with the real
  45-Claim group-chat ledger.
- Publishes 88 BBG-derived Claim–security mappings, 48 public price series,
  T+0/T+1/T+3/T+5 return and abnormal-return windows, and the available
  Dymon/BBG findings without conflating price verification with Claim truth.
- Removes generated investment prose and keeps original group wording,
  timestamp quality, speaker, mapping rationale, evidence, and price paths.
- Keeps the complete 75-campus AI Capex baseline while shortening explanatory
  copy and moving calculation notes behind compact disclosure controls.
- Adds the existing Clerk client/session gate to the Tencent production
  bundle. No Clerk secret is shipped; static JSON remains a public asset until
  a Tencent server runtime enforces authorization.
- Production deployment `dpjgwih2iu3d` succeeded. The canonical domain serves
  the new build, the Clerk modal loads on the real domain, and
  `/data/claim-ledger-dashboard.json` reports 45 Claims, 88 mappings, 48 price
  series, and data cutoff `2026-07-28`.
- A one-day EdgeOne deployment token was created for the release and expires
  on 2026-07-31; it was not persisted in the repository or shell environment,
  and the local clipboard was cleared after deployment.

## V5.4 Dense Claim and AI Capex delivery

- Event DB is now a spreadsheet-like Claim ledger with T+X returns, row
  actions, and a real price-path detail view.
- AI Capex is now a snapshot, project matrix, geocoded global buildout map, and
  visual project page. Third-party satellite images were not copied because
  the Epoch licence does not grant redistribution rights for those references.
- Settings now exposes the member invitation workflow. The production
  invitation function uses Clerk secrets stored in Tencent's masked environment
  configuration. Deployment `dpol6z9tc8tl` serves the new function and UI; no
  invitation was sent without a user-specified recipient.

## V5.5 Agentic research layer

- Adds an authenticated Tencent Cloud Function that can combine the current
  Event DB or AI Capex context with Tavily public search and DeepSeek synthesis.
- Adds fixed-height, scrollable research panels to both modules with explicit
  Hybrid, Current module, and Web evidence modes.
- Adds device-local Projects and Chats with create, rename, and confirmed
  delete actions. No shared persistence is implied.
- Adds answer actions for Personal Knowledge, Markdown download, and Obsidian
  deep-link export; the Personal Knowledge navigation now renders saved
  research and supports deletion.
- Report Library, Model Workbench, and unified AskAI remain visibly `待上线`.
- Tencent deployment `dph9nmikv34j` is live. Tavily, DeepSeek, and the
  non-secret model/runtime settings are stored as masked Tencent environment
  variables; no provider secret is present in source control.

## V5.6 Research controls and data-integrity correction

- Replaces the two bottom chat panels with one top-right contextual AskAI
  action that opens the unified scoped research workspace.
- Adds two-way Event sorting for date, T+0/T+1/T+3/T+5, observed drawdown, and
  observed upside; adds two-way AI Capex sorting for core metrics and identity
  fields.
- Splits direct-company and proxy industry/theme filters.
- Corrects the four New Hope Dairy speakers to Xu Lei.
- Normalizes BBG missing-horizon sentinels to null. The July 23 Alphabet
  sample now retains T+0/T+1 and shows no value for unavailable T+3/T+5.
- Adds owner-only Clerk member management for active users and pending
  invitations.
- Tencent deployment `dpqyrxptxqbo` is live on the canonical domain. The
  corrected Claim JSON, new JS asset, and authenticated invitation function
  were verified after release.

## V5.7 Privacy alias and Yahoo market refresh

- Applies the `BossX` privacy alias while generating publishable Claim JSON.
  Local source records retain provenance, while public data, filters, and UI
  no longer expose Xu Lei's real name.
- Adds a bounded Tencent Cloud Function for Yahoo Finance daily market data.
  The Event DB refreshes mapped securities every five minutes and recalculates
  event horizons from observed trading sessions. Missing observations remain
  blank; a Yahoo outage falls back visibly to the verified snapshot.
- Tencent deployment `dpy1coemr2uo` is live on `level-grind.com`. The canonical
  domain serves JS `index-CdsZown2.js`; production probes verified 45 claims,
  16 `BossX` references, no `Xu Lei`, and live GOOGL/0700.HK price series.

## V5.8 Cross-database AskAI candidate

- Simplifies the AI Capex matrix filters to owner, country, and status.
- Makes the unified AskAI retrieve ranked evidence from both Event DB and AI
  Capex, with explicit dataset labels and balanced six-plus-six context.
- Adds `docs/DEMO_ASKAI_QUESTIONS.md` with grounded single-library and
  cross-library prompts, expected evidence, and claims the demo must not make.
- Tencent deployment `dpxzfw1jstlt` is live. The canonical domain serves JS
  `index-CoRPDsVF.js`; production probes confirmed the cross-library AskAI copy,
  removed filter controls, and the Yahoo market function.

## V5.10 AI Capex map coverage and AskAI hierarchy

- Explains and fixes the missing China map points: the research records were
  present, but Nominatim did not recognize the English brand/campus queries.
- Adds reproducible place-name fallbacks for Huawei Horinger, VNET Bayin
  Ulanqab, and Alibaba Zhangbei, improving coverage from 51 to 54 campuses.
- Documents the 21 records that remain unresolved and keeps them off-map until
  a verifiable location exists.
- Renders AskAI assistant content as Markdown and adds compact research-oriented
  hierarchy for conclusions, headings, bullets, links, citations, and bold
  emphasis.
- Updates the DeepSeek instruction to return concise, structured Markdown.
- Targeted tests, lint, and the Tencent build pass. This candidate is not yet
  pushed or deployed.

## V5.11 AI Capex evidence-ranked location candidate

- Replaces the Nominatim-first map pipeline with a five-tier evidence hierarchy.
- Extracts explicit coordinates from local Epoch timelines and campus sources.
- Reads the selected-campus location embedded in Epoch Satellite Explorer,
  resolving all previously missing project locations without city-level
  guessing.
- Publishes 75/75 source-linked locations: 9 explicit source coordinates and
  66 Epoch Satellite Explorer campus locations.
- Adds the reviewed permit/parcel override path and keeps address/place
  geocoding as transparent fallbacks.
- Updates map tooltips and details to distinguish source coordinate, satellite,
  parcel, address, place-level, and unresolved states.
- This candidate is local only until explicit push/deploy approval.

## V5.12 GitHub production and shared-data foundation

- Adds a portable AIDC publisher that verifies the tracked manifest and copies
  75-campus dashboard and location data without reading a sibling repository.
- Adds a production-only GitHub Actions release path for the existing Tencent
  Makers project and `level-grind.com`.
- Documents the canonical branch flow, exact AIDC source/export paths, and the
  first work-computer session.
- Adds a provider-neutral PostgreSQL shared-data contract covering private
  AskAI state, explicit team publication, team research objects, file metadata,
  optimistic versions, soft deletion, audit records, vector namespaces, and
  background jobs.
- Cloud provisioning remains deliberately company-side. The personal Mac
  prepares source, contracts, and CI but is not the production database.

## V5.13 Shared-persistence release

- Provisions the public/sanitized shared-data pilot in Supabase Singapore and
  applies the base schema plus weekend Claim/usage migration.
- Adds Clerk-authenticated Tencent server APIs for shared Claim overlays with
  optimistic versions, soft deletion, and immutable audit records.
- Migrates prior browser-local Claim edits only when no newer shared row exists;
  missing shared configuration becomes visibly read-only.
- Records privacy-minimal DeepSeek usage events without storing complete user
  prompts.
- Gives the configured co-manager the same member-administration checks as the
  owner while protecting both manager accounts from accidental removal.
- Stores Supabase credentials only as masked Tencent EdgeOne environment
  variables. No database secret or colleague address is committed to GitHub.
- AskAI chat persistence, shared report/model files, automatic market refresh,
  and backup automation remain explicit follow-up increments.
- Production source `1f3472f` deployed through GitHub Actions run
  `30621461864`. The canonical site and both new function boundaries passed
  post-deploy probes; the two-real-user visibility check is handed to the first
  company-computer session.

## V5.16 Governed intake and observable AskAI candidate

- Branch: `codex/secure-research-intake-observability`.
- Prepares seven private Notes/Ideas and five original PDFs through a repeatable,
  gitignored intake manifest; no research body or attachment is committed.
- Adds contributor benefit views, PM follow-up/validation/tracking fields,
  owner-or-manager governance, and metadata-only audit evidence.
- Gives the configured primary PM the same member-management authorization as
  the owner without changing Clerk users, sessions, or invitations.
- Streams AskAI operational stages and tokens over SSE, surfaces request IDs and
  typed timeout errors, and stores metadata-only stage diagnostics.
- Configures the EdgeOne Cloud Function ceiling to 120 seconds. Work exceeding
  that ceiling must move to an asynchronous job rather than an unbounded HTTP
  request.
- Lint, 49 tests, Tencent build, desktop QA, and mobile QA pass.
- Release gate: set `LEVEL_GRIND_PRIMARY_PM_EMAIL` to Tiff's existing Clerk
  email, deploy the integrated candidate once, sign in to the canonical site,
  then import and verify seven records plus five attachments.

## V5.17 Current Event/Idea validation candidate

- Removes the old WeChat-derived Claim seed from the active Event publication
  without destroying its 45-row internal archive.
- Adds listed-company ticker mapping and real hourly Yahoo Finance validation
  to newly created Events and Ideas.
- Separates observable market reaction from analyst-owned fundamental
  validation, with editable status, evidence, next check, upside, and downside
  assumptions.
- Encrypts fundamental narrative fields at rest and preserves existing Clerk,
  manager, optimistic-version, soft-delete, and audit contracts.
- Lint, 50 tests, both production builds, live Yahoo runtime probe, and desktop
  plus mobile browser QA pass.
- Release gate: preview and approve this integrated candidate before any push
  or Tencent production deployment.

## V5.18 Private research and responsive AskAI candidate

- Repairs the AskAI response path by making observability non-blocking and
  emitting SSE readiness/status before retrieval or provider work.
- Supplies a reviewed OpenRouter fallback allowlist when the production secret
  exists but an operator list has not been configured.
- Makes raw Notes/Ideas contributor-only while allowing bounded server-side
  gray-box synthesis across team research.
- Persists AskAI Projects, Chats, and Messages privately per Clerk subject so a
  user sees the same history on desktop and mobile.
- Re-prepares the seven Tiff records and five original attachments under the
  new privacy policy; import is intentionally deferred until after deployment.
- Lint, 51 tests, the application build, and the Tencent portable build pass.
- Remaining gate: canonical-domain authenticated provider smoke test, then one
  reviewed deployment and idempotent Tiff batch import.

## V5.22 Chat-level capture and governed research visibility candidate

- Removes Fable 5 from the visible and server-side fallback model allowlists.
- Moves Markdown download and Obsidian export to the Chat level; individual
  answers retain only a favourite action.
- Stores new favourite answers and chats in the same private Clerk-subject
  history envelope used by AskAI, so the Personal Knowledge view can follow the
  same account across devices.
- Keeps Personal Knowledge and AskAI conversations private even from member
  managers. Separately, configured managers can review all raw Notes/Ideas,
  while ordinary members can list only their own records.
- Limits gray-box team retrieval to records explicitly permitting internal AI
  processing.
- Verifies ESLint, 55 tests, the portable Tencent build, and local browser QA.
- Does not claim production attachment readiness: the TencentDB/COS/ingestion
  route still needs configured-service and two-account read-back evidence.
- Release remains uncommitted and undeployed pending product-owner approval.

## V5.23 Tencent Notes / Ideas production readiness

- EdgeOne deployment `dp0q2hmd0lqe` is live on the canonical domain.
- TencentDB, COS direct upload and SCF server-side parsing are proven with
  disposable synthetic Markdown and PDF fixtures; refresh/read-back passed.
- New Notes and Ideas enter the internal blind-hash gray-box index by default,
  while raw list visibility remains contributor-or-manager controlled.
- AskAI retrieved the unique synthetic production marker and returned a
  grounded answer in 4.3 seconds.
- The remaining production acceptance gate is an ordinary-member Clerk session
  proving that the same records are absent from the raw library list while the
  gray-box AskAI path remains available.
- No Git commit or push was made in this release pass; the existing dirty
  worktree and unrelated user changes were preserved.

## V5.24 Governed external-AI release

- SCF now runs the Linux AMD64 image `20260806-6-amd64`; `/health` and `/ready`
  both pass with TencentDB and envelope encryption ready.
- EdgeOne deployment `dp64p8eb3bjo` enforces the external-provider boundary:
  team records can remain internally indexed without automatically being sent
  to DeepSeek or OpenRouter.
- Public records, or records explicitly allowing external AI and not requiring
  redaction, may be supplied to an external provider. Internal/Confidential
  records with external AI disabled remain absent from provider context.
- Production Notes and Ideas read-back, COS attachments and server-side parsing
  remain healthy after the release.
- The only remaining acceptance item is a separate ordinary-member Clerk
  session for raw-list isolation. No commit or push was made.

## V5.25 Upload-first research intake and portable graph candidate

- Notes and Ideas now start from file upload, show a first-record call to action,
  celebrate the first confirmed write, and keep manual forms secondary.
- Mixed-company attachments create explicit review candidates rather than
  silently inventing multiple Ideas.
- Managers may attribute a source file to Tiff while the real uploader remains
  recorded in the audit trail; Clerk users, sessions, and invitations are unchanged.
- AskAI is first in navigation and has more usable vertical space.
- Idea Graph is a full-width, portable candidate relationship view; Ideas rows
  expose date, proposer, company, ticker, direction, and percentage.
- The official Epoch snapshot is refreshed to 77 campuses and 77 located records;
  a daily refresh workflow is ready.
- Twelve supplied files are prepared in a private local import manifest and pass
  dry-run validation. They have not been uploaded to production.
- ESLint, 64 tests, the production build, importer syntax, diff validation, and
  desktop/mobile browser QA pass. Release remains pending explicit approval.

## V5.26 Investment Graph fidelity and model-route release gate

- Replaces the simplified graph candidate with the portable atlas from the
  `investment-graph` research prototype: three-column controls/canvas/inspector,
  industry and market multi-select, Long/Short/Observation summaries, search,
  zoom, relayout, relationship legends and node-level thesis details.
- Preserves daily graph evolution with a manual range control and timed playback
  across the 2026-08-03 to 2026-08-06 snapshots.
- Keeps the component self-contained inside Level Grind; the production build
  has no runtime dependency on the sibling repository.
- Makes the local AskAI boundary explicit: the Vite UI is not a provider
  runtime. Local provider tests require the loopback function harness, while
  release acceptance uses the authenticated EdgeOne function and real SSE.
- Release may proceed only after lint/tests/build, desktop interaction QA, and
  authenticated DeepSeek/OpenRouter first-token checks pass.
