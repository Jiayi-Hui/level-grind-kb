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
