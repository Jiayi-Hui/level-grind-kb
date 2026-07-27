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
- [ ] Validate, publish, and verify the revised production demo.
- [ ] Add and test the user's company email after the exact address is supplied.
