# PRD — Level Grind Research OS

## Objective

Build an anywhere-accessible, multi-user research workspace that combines a
governed report library, AI-assisted research, durable question history,
personalized workflows, transparent usage/cost controls, and selective capture
of public web evidence.

This document is the whole-product view. New ideas are added here before they
are treated as delivered.

## Users

- **PM / owner (Tiff):** broadest storage quota, full team operations and usage
  visibility, member administration, and access to all approved shared research.
- **JEM PM (Lydia):** PM-oriented workspace and approved team research.
- **Analyst:** personal research workspace plus approved shared material.
- **Other invited users:** named during onboarding and assigned a governed role.

## Product Principles

1. Store one shared source once; access does not duplicate storage into each
   reader's quota.
2. Keep model keys server-side and meter every query, token, cost, latency, and
   status.
3. Separate report evidence, public-web evidence, and model inference.
4. Let users deliberately promote useful web results into the knowledge base.
5. Keep one navigation entry per research workflow. Question history belongs
   inside Research Q&A; low-frequency profile/context controls belong in Settings.
6. Make waiting visible through loading, progress, success, and error states.
7. Never claim a connector or search capability that is not configured.
8. Preserve source URLs, dates, ownership, scope, and provenance when exporting.

## Current Product Surface

| Capability | State | Notes |
|---|---|---|
| Clerk Gmail sign-in and D1 membership | Live | Owner/admin/member authorization |
| CNINFO report library | Live | 30 reports, 15 companies, 6,237 indexed pages |
| R2 files + D1 metadata/page text | Live | Shared physical corpus |
| DeepSeek report Q&A | Live | Server-side key, usage metering, citations |
| Chinese / English interface | Live | Persisted per user |
| Welcome-back release banner | This increment | Shown per Clerk login session |
| Markdown answer rendering | This increment | Bold, headings, lists, links, citations |
| Saved Q&A history | Live | Shown inside Research Q&A by project and conversation |
| Web / report / hybrid research modes | This increment | DeepSeek synthesizes supplied evidence |
| Select web result into knowledge base | This increment | Explicit user action and provenance |
| Personal storage quota view | This increment | Personal uploads only; shared corpus separate |
| Persona onboarding | Planned | PM, JEM PM, Analyst, other name |
| Semantic/vector retrieval | Planned | Current report retrieval is keyword ranked |
| Company Azure gateway | Planned | Depends on company network approval |
| HK/US/JP/TW/KR filing adapters | Planned | CNINFO is the first source adapter |
| Cross-library search | This increment | Searches Personal Knowledge, reports, and events from one entry |
| Contextual “Ask about this” | This increment | Hands selected material into the canonical Research Q&A |
| Model Workbench | This increment | Excel-first registry, variable review, lineage, change log, and export |

## Functional Requirements

### Identity, onboarding, and personalization

- FR-1: Authenticate with Clerk and authorize against active D1 membership.
- FR-2: Persist the user's interface language and research profile.
- FR-3: Show a welcome-back banner after each new authenticated session with
  release-specific changes.
- FR-4: Move low-frequency coverage, output preference, working method, and
  private-memory controls into Settings.
- FR-5: Future adaptive personalization must be auditable and must not silently
  change factual records or permissions.

### Storage and corpus

- FR-6: Show personal storage used, quota, and remaining capacity in Settings.
- FR-7: Shared report-corpus files do not count against a reader's personal quota.
- FR-8: Owner/admin imports accept 25 MB interactive PDFs; larger controlled
  batches use chunked ingestion.
- FR-9: Report opening starts immediately in a new browser tab and exposes a
  visible opening state.
- FR-9A: Long-running AI answers expose elapsed time without revealing hidden
  chain-of-thought content.

### Research assistant

- FR-10: Render model Markdown safely instead of showing Markdown markers.
- FR-11: Offer Report library, Web, and Hybrid evidence modes.
- FR-12: DeepSeek remains the reasoning model; public-web search is a separate
  server-side tool/provider invoked by the application.
- FR-13: Report claims cite indexed page evidence. Web claims cite source URLs.
- FR-14: A user can select a web result and save it as personal or team
  knowledge with its original URL and search provenance.
- FR-15: Every completed query is saved to the requesting user's history with
  question, answer, mode, sources, model, token use, cost, and timestamp.
- FR-16: A user can reopen and export a prior answer as Markdown or hand it to
  an Obsidian vault via the local Obsidian URI scheme.
- FR-16A: The saved Obsidian vault name is optional. A blank value omits the
  vault parameter so Obsidian can use the currently open vault; saving the
  setting never implies that Obsidian will open immediately.

### Operations

- FR-17: Each user sees only their own AI usage. Owner/admin sees team usage.
- FR-18: Owner/admin can manage members from Settings.
- FR-19: Secrets never enter the browser bundle, Git history, or exported notes.

## Non-Goals for This Increment

- Scraping public search results without a governed provider or API agreement.
- Pretending the DeepSeek Chat website's bundled web-search UI is part of the
  standard DeepSeek API. The API supplies tool calling; Level Grind supplies the
  actual search tool.
- Background modification of a user's private research thesis without a visible
  audit trail.
- Full two-way Obsidian synchronization. This increment exports Markdown and
  opens the local Obsidian URI.
- OCR for scanned/image-only filings.
- Automatic purchase or storage of licensed sell-side research.
- A web-native replacement for Excel. The first model-workbench increment will
  register, govern, update, and compare existing workbooks before considering
  formula-engine migration.

## Acceptance Criteria

- AC-1: `**bold**` and list Markdown render correctly in answers.
- AC-2: Chinese/English switching updates the primary interface and survives
  refresh on another device for the same account.
- AC-3: New Clerk login sessions show Welcome back and current release notes.
- AC-4: The sidebar contains one entry per research workflow; question history
  is inside Research Q&A rather than a separate sidebar tab.
- AC-5: Settings contains language, research profile, storage remaining,
  Obsidian vault, and role-appropriate team access controls.
- AC-6: Every successful answer is available in its Research Q&A conversation
  after refresh.
- AC-7: Prior answers can export Markdown and invoke Obsidian with copied content.
- AC-8: Report open buttons show progress and open a feedback tab immediately;
  the tab is replaced by the protected PDF when its download is ready.
- AC-9: Web/Hybrid modes fail clearly when no search provider is configured.
- AC-10: Configured web results display provenance and can be saved explicitly
  into the knowledge base.
- AC-11: Lint, TypeScript, tests, production build, and hosted deployment pass.
- AC-11A: The Research Q&A waiting state shows a spinner and elapsed seconds.
- AC-11B: The primary knowledge navigation label is “个人知识库” in Chinese.

## Risks and Decisions

- DeepSeek's API supports function/tool calling but does not provide the
  DeepSeek consumer app's bundled web-search results as a drop-in API feature.
  Level Grind therefore uses a separately configured search provider and sends
  retrieved evidence to DeepSeek for synthesis.
- Personal storage quotas are product-policy values, not Cloudflare account
  hard limits. Enforcement on uploads is a later increment; this increment
  reports usage accurately.
- Public-web content may change or disappear. Saved items preserve URL,
  excerpt, capture time, and provenance but are not a licensed archival copy.
- Existing routing/context tables remain in D1 for backwards compatibility,
  but they are removed from the product navigation.
- Research Q&A remains the canonical conversation surface. Future contextual
  launchers in Personal Knowledge, Report Library, and Event DB should prefill
  scope and hand off to that surface rather than create separate chat histories.

## V4.5 — Event Knowledge Model

- FR-20: Event DB is Event-first for team consumption and Claim-first for
  ingestion and verification.
- FR-21: Claims remain independent source statements after verification; they
  never mutate into Events.
- FR-22: Claim–Event links record whether a Claim supports, contradicts,
  predicts, explains, denies, or suggests an Event.
- FR-23: Team attention is stored as a Team Notice with actor, time, channel,
  notice type, and salience—not as an Event boolean.
- FR-24: The product exposes an Event timeline and a Claims inbox while keeping
  raw private chat content outside the shared repository.

Acceptance:

- AC-12: Existing 45 Events migrate without destructive changes.
- AC-13: Dymon/BBG findings appear as source-verified Claims linked to the
  relevant partially verified Events.
- AC-14: Every cold-start Event has a privacy-preserving Team Notice.
- AC-15: Event cards show only the event, company/ticker, exact known date,
  verification status, and the latest attributed source statement. Coarse week
  labels and seed filenames stay out of the card.

## V4.6 — Demo Information Architecture and Readability

- FR-25: “Knowledge base” contains saved notes, links, conclusions, and selected
  evidence; “Report library” is its source-document layer.
- FR-26: Research Q&A owns its conversation history. No separate History
  navigation entry is shown.
- FR-27: Event cards use Chinese-readable type sizing and do not expose internal
  fields such as Metric, PM relevance, Evidence, Team Notice, or seed filenames.
- FR-28: A claim timestamp is displayed only when the source data contains an
  exact calendar date; week labels such as W30 are not presented as dates.

## V4.7 — Model Workbench Direction

- FR-29: Treat the model workbook, source-linked inputs, assumptions, outputs,
  version history, and review state as separate governed objects.
- FR-30: Phase one keeps Excel as the analyst calculation surface while the web
  product provides a model registry, freshness checks, source lineage, update
  jobs, change review, and scenario-output comparison.
- FR-31: A future Microsoft 365 bridge may read and write approved workbooks
  through company-governed APIs; it must not expose licensed data outside the
  approved boundary.
- FR-32: Quant transition is enabled by turning workbook inputs and outputs into
  typed, versioned datasets and reproducible jobs—not by cloning the spreadsheet
  grid alone.

## V4.8 — Unified Research and Model Operations

- FR-33: Research Q&A has a viewport-bounded shell. Projects, Chats, and messages
  scroll independently so a long answer never lengthens the whole page.
- FR-34: Existing research projects can be renamed without losing their chats.
- FR-35: Global search returns categorized matches from Personal Knowledge,
  reports, and events; selecting a result opens the correct workspace context.
- FR-36: Report Library supports company, sector, report-type, and year filters.
- FR-37: Event DB supports event-type, company, quarter, and sector dimensions.
- FR-38: Event provenance is human-readable: `来源 · WeChat Group`, an actual
  speaker only when present, and a verification source only when supplied.
- FR-39: Personal Knowledge, Report Library, and Event DB expose “Ask about this”
  launchers that prefill scope in one canonical Research Q&A history.

## V5.0 — PM Event Research Demo

- FR-40: Event DB opens on a cross-event research surface with search by event,
  trigger, company, and ticker plus filters for shock, demand state, and year.
- FR-41: A selected historical event shows T+1/T+5/T+20 returns, maximum
  drawdown, breadth, benchmark-relative price path, sector dispersion, security
  reactions, and source links.
- FR-42: Each event exposes a clearly labeled investment read-through with
  stance, causal logic, falsification conditions, and a non-advice disclaimer.
- FR-43: A secret-protected Claim Inbox accepts WeChat Bot → Codex messages
  idempotently and persists them in D1 without requiring a site rebuild.
- FR-44: While Event DB is open, the browser refreshes Event and Claim state
  every three seconds and shows the newest WeChat-derived Claims prominently.

Non-goals for the demo:

- automatic execution of trades;
- treating an unverified WeChat statement as a confirmed Event;
- exposing the claim-ingestion secret to the browser or repository;
- replacing the full analyst verification workflow with generated commentary.
- FR-40: Model Workbench stores an Excel model registry with company, owner,
  version, update time, stale-variable count, sources, and change history.
- FR-41: A standard `.xlsx` template maps Inputs, Calculations, and Outputs for
  browser review. Arbitrary `.xlsx` files remain versionable, while unmapped
  workbook logic continues to run in Excel.
- FR-42: Newer company reports and events create review candidates, never
  automatic numeric writes. An analyst supplies or confirms the value before
  it is written to the managed variable and exported workbook.
- FR-43: The primary workspace is usable at phone widths, with stacked controls,
  horizontally scrollable compact tabs, and bounded content regions.

Acceptance:

- AC-16: Research Q&A message output cannot push Projects or Chats below the
  viewport; each list and the message thread has its own scroll region.
- AC-17: A project rename persists through the authenticated API.
- AC-18: Search and filter controls return only real records already available
  to the signed-in user.
- AC-19: Source and verification labels never invent a speaker, date, or data
  provider.
- AC-20: The sample workbook opens with formula-backed calculations, mapped
  inputs/outputs, source lineage, an update queue, and a change-log sheet.
- AC-21: Export applies reviewed input values to their mapped cells and tells
  Excel to recalculate formulas on open.

## V5.1 AI Capex Dashboard

### Objective

Add AI Capex as a peer Level Grind workspace, using the reviewed/open exports
from `aidc-capex-tracker` to answer where AI data-center power, compute, and
estimated physical capital are concentrated and how the buildout changes over
time.

### Users and decisions

- PM: compare owner capacity and identify projects that merit follow-up.
- Analyst: inspect project history, metric lineage, freshness, and exact sources.
- Research operator: rerun a deterministic import without creating a runtime
  dependency on the research repository.

### Functional requirements

- FR-44: AI Capex appears between Event DB and Model Workbench in desktop and
  mobile navigation and renders inside the existing right-side workspace.
- FR-45: `scripts/sync-aidc-capex.mjs` reads the sibling research repository and
  writes a versioned portable snapshot to both `data/aidc-capex/` and
  `public/data/aidc-capex/`.
- FR-46: The snapshot records schema/model versions, generation and cutoff
  dates, source snapshots, record counts, known limitations, and SHA-256
  integrity information.
- FR-47: The dashboard shows source-attributed KPIs, owner comparison,
  historical/planned capacity timeline, status pipeline, project matrix,
  project detail, and source/freshness ledger.
- FR-48: Owner, country, status, confidence, and freshness filters compose.
- FR-49: Every material metric exposes its own source references, observation
  date, data cutoff, Level Grind sync time, and method.
- FR-50: Historical/current observations and Epoch baseline plans use distinct
  visual treatments. Reviewed p10/p50/p90 bands render only when an approved
  forecast export exists.

### Explicit non-goals

- No building-level stage, geometry, delay probability, four-quarter forecast,
  or company Capex Momentum is inferred for this release.
- No browser-side CSV parsing and no runtime reads from the sibling repository.
- Epoch estimates are not presented as company-reported accounting Capex.
- No decorative map without source-backed building geometry.

### Acceptance

- AC-22: Navigation order is Personal Knowledge, Report Library, Event DB,
  AI Capex, Model Workbench, AskAI, Settings in both languages.
- AC-23: The portable snapshot contains the 75-campus baseline, 424 project
  timeline rows, 205 site-chip-date records, 176 hardware records, source
  lineage, and file checksums.
- AC-24: At least three decision-useful charts plus the project matrix render
  without unsupported forecast or delay data.
- AC-25: Loading, error, empty, partial-data, and stale states are visible and
  actionable without dead controls.
- AC-26: Desktop and phone layouts keep filters, charts, table, project detail,
  and source references readable.

## V5.3 — Real Claim Ledger and Tencent Clerk Gate

### Objective

Replace the narrative-heavy historical-event prototype with the team's real
WeChat Claim ledger and its BBG/public event-window outputs. Add the existing
Clerk identity gate to the Tencent continuity build without implying that
client-side authentication protects static JSON assets.

### Requirements

- FR-51: Event DB uses the 45-Claim date ledger, including original group-chat
  wording, speaker, HKT time when known, date evidence type, content-verification
  status, and effective period.
- FR-52: The 88 Claim–security mappings retain direct/proxy classification,
  benchmark, BBG-derived T+0/T+1/T+3/T+5 returns, abnormal returns, and public
  price cross-check status.
- FR-53: A price event window never upgrades Claim content to verified.
- FR-54: Dymon/BBG evidence is displayed as attributed evidence rows, not
  generated investment advice.
- FR-55: Users can search/filter Claims, inspect one Claim and its securities,
  and compare up to four Claims by mapped-security median return.
- FR-56: The Event DB removes generated stance, similarity, demand-state, and
  investment-read-through prose.
- FR-57: The Tencent static build restores the existing Clerk sign-in and user
  session UI. Server-side authorization and protected data delivery remain a
  separate Tencent full-stack migration.
- FR-58: AI Capex keeps its source/date/method contract but uses compact
  evidence rows and direct labels.

### Acceptance

- AC-27: The published Event DB reports 45 Claims, 88 security mappings, 48/48
  public price coverage, and the actual ledger cutoff.
- AC-28: Original Claim wording and known speakers/timestamps match the source
  workbook; missing fields remain visibly pending.
- AC-29: No generated investment recommendation or unsupported verification
  label appears.
- AC-30: Clerk sign-in gates the Tencent UI and a signed-in account can open the
  Event DB and AI Capex.
- AC-31: Static JSON confidentiality is explicitly not claimed until a
  Tencent-side authenticated API is deployed.
