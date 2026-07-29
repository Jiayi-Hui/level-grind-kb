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
- [x] Attach `level-grind.com`; DNS validation is pending at the domain provider.

## V5.0 — Tomorrow PM Event Demo

- [x] Keep the whole Level Grind product as the demo container.
- [x] Integrate the validated event-db historical price-reaction snapshot.
- [x] Add cross-event search, classification, price paths, and investment
  read-throughs.
- [x] Add a secret-protected, idempotent Claim Inbox API.
- [x] Poll live Event and Claim data while the Event DB is visible.
- [ ] Configure the hosted secret and connect the existing WeChat/Codex bridge.
- [ ] Publish the validated source.
- [ ] Put EdgeOne in front of the hosted app and test Mainland desktop/mobile.
- [ ] Rehearse one deterministic WeChat message and one fallback replay payload.
