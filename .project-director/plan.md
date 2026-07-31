# Plan — Context Infra V3

- [x] Inspect current release and user-demand map.
- [x] Define product boundary and acceptance criteria.
- [x] Extend the persistent context model.
- [x] Implement personal, team, task, and boundary views.
- [x] Enforce personal/team visibility in server routes.
- [x] Generate and inspect migrations.
- [x] Integrate Clerk authentication on the Alpha branch.
- [x] Define conversation-routing policy and workstream contract.
- [x] Implement routing persistence, API, and interface.
- [x] Generate and inspect additive migrations.
- [x] Run typecheck, lint, tests, and production build.
- [x] Commit and push the validated Alpha source.
- [x] Keep nightly conflict-aware synchronization in the separate Context Infra project.
- [x] Add persistent members, roles, and admin authorization.
- [x] Add Multi-user Alpha team access UI.
- [x] Generate and inspect the membership migration.
- [x] Deploy after Clerk variables and owner bootstrap are verified.

## V4 — Team Research OS

- [x] Frame storage, onboarding, corpus, and Azure AI architecture.
- [ ] Confirm company-Azure data boundary and identity mappings.
- [ ] Build V4.1 persona onboarding and quota ledger.
- [ ] Build V4.2 document taxonomy and public-document preload.
- [x] Build and sample-validate the CNINFO annual/half-year report fetcher.
- [x] Run the first CNINFO portfolio batch from the WeChat company universe.
- [x] Add R2-backed PDF storage and D1-backed corpus/search/usage records.
- [x] Add a provider-neutral server adapter for DeepSeek, GLM, and Kimi.
- [x] Publish the storage-enabled version and verify hosted D1/R2 wiring.
- [x] Import and re-verify the first 30-report CNINFO corpus in production.
- [x] Raise interactive PDF uploads to 25 MB and add chunked bootstrap ingestion for larger files.
- [ ] Add HKEX, SEC, JPX, TWSE, and KRX source adapters for the remaining companies.
- [ ] Build V4.3 Azure gateway and permission-filtered semantic retrieval.

## V4.4 — Research OS Experience

- [x] Maintain a whole-product PRD with live, current-increment, and planned states.
- [x] Replace the context-heavy navigation with Inbox, Library, Ask, History, and Settings.
- [x] Remove Conversation routing from the product UI and API surface.
- [x] Add account-persisted Chinese/English localization.
- [x] Add per-login Welcome back release notes.
- [x] Render answer Markdown safely.
- [x] Persist private Q&A history with usage and evidence.
- [x] Add Markdown and Obsidian URI export.
- [x] Stream report opening in a new tab with visible progress.
- [x] Add Report, Web, and Hybrid evidence contracts.
- [x] Add selective web-result capture with provenance.
- [x] Add personal storage/quota visibility and shared-corpus separation.
- [x] Pass lint, TypeScript, production build, and focused tests.
- [x] Deploy validated Research OS version 11 and verify production route/auth health.
- [ ] Complete the authenticated owner-session browser walkthrough.
- [x] Configure the Tavily public-web search key in the hosted environment.

## V4.5 — Event / Claim / Team Notice

- [x] Pull the work-computer Event seed and Dymon/BBG verification findings.
- [x] Preserve 45 existing Events and apply 13 partial-verification updates.
- [x] Add independent Claims, Claim–Event links, and Team Notices.
- [x] Generate 62 Claims, 106 relations, and 45 privacy-preserving Notices.
- [x] Add Event timeline and Claims inbox views.
- [x] Add authenticated read and owner/admin write APIs.
- [x] Add and validate additive D1 migrations and seed migration.
- [x] Pass lint, TypeScript, build, model tests, and migration replay.
- [x] Publish and verify production version 12.

## V4.6 — Demo IA and Event Readability

- [x] Consolidate Q&A history into the Research Q&A surface.
- [x] Rename Research inbox to Knowledge base and define Report library as its
  source-document layer.
- [x] Simplify Event cards to event, company/ticker, exact date, status, and
  attributed source statement.
- [x] Hide W30, generated Team Notice prose, seed filenames, and internal
  Metric/PM/Evidence fields from Event cards.
- [x] Configure Tavily without placing its key in source control.
- [x] Validate, publish, and verify the revised production demo.
- [x] Configure one company-email pilot account without inviting other members.

## V4.7 — Personal Knowledge, Waiting Feedback, and Model Direction

- [x] Rename the primary knowledge surface to Personal Knowledge.
- [x] Remove the invented `Research` Obsidian vault fallback.
- [x] Explain local vault-setting behavior and support the currently open vault.
- [x] Show real report-opening feedback in the destination tab and source card.
- [x] Show elapsed seconds while Research Q&A is waiting.
- [x] Research institutional model-maintenance patterns and define an
  Excel-first hybrid Model Workbench boundary.
- [x] Design and implement the Excel-first Model Registry schema.
- [x] Add contextual cross-library Q&A launchers after retrieval-scope contracts
  are specified.
- [ ] Validate the pilot company-email Clerk login in the user's browser.

## V4.8 — Unified Research and Model Operations

- [x] Bound the Research Q&A viewport and add independent internal scrolling.
- [x] Add persistent project renaming.
- [x] Add categorized cross-library search.
- [x] Add report and multidimensional event filters.
- [x] Clarify event speaker, WeChat Group, and verification-source provenance.
- [x] Extend hybrid Q&A retrieval to knowledge, reports, events, and web.
- [x] Add contextual “Ask about this” launchers.
- [x] Add D1/R2 Model Workbench data and file contracts.
- [x] Add safe template mapping, reviewed input updates, and Excel export.
- [x] Generate and visually validate a formula-backed sample workbook.
- [x] Add responsive desktop/tablet/mobile layouts.
- [x] Publish the validated source and verify the production deployment.
- [x] Attach and validate `level-grind.com` with HTTPS routing to Sites.

## V5.0 — Tomorrow PM Event Demo

- [x] Keep the whole Level Grind product as the demo container.
- [x] Integrate the validated event-db historical price-reaction snapshot.
- [x] Add cross-event search, classification, price paths, and investment
  read-throughs.
- [x] Add a secret-protected, idempotent Claim Inbox API.
- [x] Poll live Event and Claim data while the Event DB is visible.
- [x] Configure the hosted Claim Inbox secret and validate the protected route.
- [ ] Connect and exercise the existing WeChat/Codex bridge with one real claim.
- [x] Publish the validated source.
- [x] Route `level-grind.com` directly to the Sites custom-domain endpoint for
  the Hong Kong demo; do not use the failed EdgeOne reverse proxy.
- [ ] Test no-VPN access on the PM's physical Hong Kong device.
- [ ] Rehearse one deterministic WeChat message and one fallback replay payload.

## V5.1 — AI Capex Dashboard

- [x] Read the research handoff, export contract, evidence framework, and Epoch
  snapshot manifest.
- [x] Inspect the Level Grind navigation, client-view, styling, build, and test
  patterns without modifying unrelated work.
- [x] Define the portable `aidc-capex.v1` contract and evidence/freshness rules.
- [x] Implement and verify the repeatable AIDC sync.
- [x] Add AI Capex navigation, bilingual headings, and mobile access.
- [x] Build source-attributed KPIs, owner/timeline/status charts, matrix,
  project detail, and source ledger.
- [x] Add all loading/error/empty/partial/stale states and responsive styles.
- [x] Run targeted tests, lint, build, and desktop/mobile browser review.
- [x] Record QA/delivery evidence and create a local commit only.

## V5.2 — Tencent Hong Kong Continuity Cutover

- [x] Reproduce the Hong Kong access failure before authentication.
- [x] Reject the EdgeOne reverse-proxy design after its Sites origin returned
  HTTP 403.
- [x] Build a Tencent-native continuity bundle with Event Research and AI
  Capex data included.
- [x] Publish and browser-check the bundle on an `edgeone.dev` deployment.
- [x] Bind `www.level-grind.com`, provision managed HTTPS, redirect the apex,
  and remove the `chatgpt.site` request path.
- [x] Verify the apex redirect, custom domain, core JSON assets, and desktop
  browser flow.
- [ ] Confirm one physical Hong Kong no-VPN visit after DNS propagation.
- [ ] Migrate Clerk-equivalent authentication, write APIs, D1/R2 exports,
  reports, AskAI, Model Workbench, and Claim Inbox to a Tencent-compatible
  full-stack runtime after the access-critical demo.

## V5.3 — Real Claim Ledger and Tencent Clerk Gate

- [x] Inspect the Claim date workbook with the spreadsheet workflow.
- [x] Reconcile the 45 Claims with 88 BBG event-study rows and 48 public series.
- [x] Define and generate the `claim-ledger.v1` portable contract.
- [x] Replace the narrative Event Research view with the Claim ledger.
- [x] Remove generated investment prose and preserve evidence boundaries.
- [x] Compact AI Capex copy and evidence metadata without dropping lineage.
- [x] Add the existing Clerk client/session gate to the Tencent build.
- [x] Run full lint/tests/build and desktop/mobile browser QA.
- [x] Publish the validated Tencent bundle and verify Clerk + both workspaces.

## V5.6 — Research controls and integrity correction

- [x] Trace the apparent `-100%` return to the missing-horizon BBG sentinel.
- [x] Normalize unobserved future horizons to null and regenerate both Claim
  dashboard copies.
- [x] Correct the four New Hope Dairy speaker records to Xu Lei.
- [x] Separate event company and industry/theme filters.
- [x] Add event and AI Capex sorting with missing values last.
- [x] Move module research entry to the page header and unified AskAI view.
- [x] Add the Clerk-backed Settings member list.
- [x] Give the owner and configured co-manager the same member-management
  authorization without exposing a named-person-only permission statement.
- [x] Run lint, targeted tests, and the Tencent production build.
- [x] Complete desktop/mobile browser QA and publish the Tencent deployment.

## V5.7 — Privacy alias and Yahoo refresh

- [x] Apply the BossX alias before public dashboard JSON is generated.
- [x] Add the bounded Tencent Yahoo Finance proxy.
- [x] Refresh mapped securities and recalculate event horizons in the browser.
- [x] Preserve an explicit verified-snapshot fallback.
- [x] Add regression tests and validate live Yahoo responses.
- [x] Complete browser QA, deploy Tencent, and verify the canonical domain.

## V5.8 — Cross-database AskAI

- [x] Remove confidence and freshness from AI Capex matrix filters.
- [x] Retrieve ranked evidence from Event DB and AI Capex for every internal or
  hybrid question.
- [x] Update the AskAI labels and examples to expose cross-database research.
- [x] Add a current-data demo-question guide.
- [x] Run targeted tests, lint, and the Tencent production build.
- [x] Publish to Tencent after release approval and verify the canonical domain.

## V5.9 — Shared research state and automatic Claim tracking

- [ ] Replace device-local Claim add/edit/delete state with authenticated shared
  persistence so authorized users see the same records.
- [ ] Move AskAI projects, chats, and saved Personal Knowledge from browser-only
  storage to user/team-scoped persistence.
- [ ] Require or resolve company, ticker, Yahoo symbol, and event timestamp when
  a Claim should be market-tracked.
- [ ] Create the initial event-price baseline and refresh future trading sessions
  automatically, with missing mappings and provider failures shown explicitly.
- [ ] Preserve editor identity, timestamps, change history, privacy aliases, and
  conflict-safe updates.

## V5.12 — Production branches and shared-data foundation

- [x] Define `production`, `main`, and `feature/*` responsibilities.
- [x] Add a production-only GitHub Actions deployment to the existing EdgeOne
  project.
- [x] Split portable AI Capex publication from research-source refresh and
  network geocoding.
- [x] Document exact AIDC CSV/JSON paths and work-computer takeover steps.
- [x] Define private/team ownership, explicit publication, ACL-aware retrieval,
  object storage, versions, audit, soft delete, concurrent edits, vector
  namespaces, background jobs, and raw-evidence separation.
- [x] Add the provider-neutral PostgreSQL base migration.
- [ ] Add the EdgeOne API token as a GitHub encrypted secret.
- [ ] Provision and migrate the approved production database from the work
  computer.
- [ ] Connect UI/API state to the production persistence implementation.

## V5.13 — Weekend shared-persistence cutover

- [x] Reconfirm the private/team data boundary and takeover gate.
- [x] Reject browser-local state and tracked JSON as authoritative shared
  storage.
- [x] Confirm weekend shared persistence will contain only public or sanitized
  demo data.
- [x] Confirm the cloud account/provider, region, and billing route.
- [x] Provision the HTTPS-reachable relational service and server-only secrets.
- [x] Apply the reviewed migrations for the public/sanitized pilot.
- [x] Add Clerk-authenticated shared APIs with version, soft-delete,
  and audit enforcement.
- [x] Replace device-local Claim mutations with shared reads/writes and migrate
  existing local overlays without overwriting newer shared rows.
- [ ] Persist AskAI projects/chats privately by Clerk user.
- [x] Persist every Tencent DeepSeek request timestamp and usage event by Clerk
  user so adoption can be measured without storing full prompts by default.
- [ ] Add export/restore automation and a migration handoff.
- [ ] Run two-user, two-device, redeploy-survival, and conflict tests.
- [ ] Merge to `main` only after the takeover acceptance gate passes.

## V5.15 — Platform release train

- [x] Define feature branches as bounded implementation batches rather than
  individual production releases.
- [x] Require integration testing on `main` before production promotion.
- [x] Keep `production` quiet except for an approved release candidate.
- [x] Package shared persistence, member-manager parity, and usage auditing into
  one tested release candidate instead of deploying them separately.
- [x] Record full QA evidence and obtain release approval before promotion.
- [ ] Run authenticated and canonical-domain smoke tests after the single
  production deployment.

## V5.10 — AI Capex map coverage and AskAI readability

- [x] Identify every unresolved AI Capex map record.
- [x] Add reproducible place-name fallbacks for all three China campuses.
- [x] Show located and unresolved campus counts in the map header.
- [x] Render AskAI assistant responses through the shared Markdown component.
- [x] Add readable heading, list, link, and bold emphasis styles.
- [x] Ask the model for concise, consistently structured Markdown.
- [x] Run targeted tests, lint, and the Tencent production build.
- [ ] Publish after explicit release approval.
