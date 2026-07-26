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
- [ ] Deploy the validated Research OS version and complete authenticated browser QA.
- [ ] Configure a governed public-web search API key.
