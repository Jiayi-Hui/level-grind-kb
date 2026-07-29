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
