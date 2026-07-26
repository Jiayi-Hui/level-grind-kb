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
5. Keep frequently used research actions in the main navigation; move
   low-frequency profile/context controls into Settings.
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
| Chinese / English interface | This increment | Persisted per user |
| Welcome-back release banner | This increment | Shown per Clerk login session |
| Markdown answer rendering | This increment | Bold, headings, lists, links, citations |
| Saved Q&A history | This increment | Reopen, Markdown export, Obsidian URI handoff |
| Web / report / hybrid research modes | This increment | DeepSeek synthesizes supplied evidence |
| Select web result into knowledge base | This increment | Explicit user action and provenance |
| Personal storage quota view | This increment | Personal uploads only; shared corpus separate |
| Persona onboarding | Planned | PM, JEM PM, Analyst, other name |
| Semantic/vector retrieval | Planned | Current report retrieval is keyword ranked |
| Company Azure gateway | Planned | Depends on company network approval |
| HK/US/JP/TW/KR filing adapters | Planned | CNINFO is the first source adapter |

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

## Acceptance Criteria

- AC-1: `**bold**` and list Markdown render correctly in answers.
- AC-2: Chinese/English switching updates the primary interface and survives
  refresh on another device for the same account.
- AC-3: New Clerk login sessions show Welcome back and current release notes.
- AC-4: The sidebar contains research actions only; Conversation routing and
  the three context pages are not exposed.
- AC-5: Settings contains language, research profile, storage remaining,
  Obsidian vault, and role-appropriate team access controls.
- AC-6: Every successful answer is available in History after refresh.
- AC-7: History can export Markdown and invoke Obsidian with copied content.
- AC-8: Report open buttons show progress and start the response in a new tab
  without waiting for a full browser-side Blob download.
- AC-9: Web/Hybrid modes fail clearly when no search provider is configured.
- AC-10: Configured web results display provenance and can be saved explicitly
  into the knowledge base.
- AC-11: Lint, TypeScript, tests, production build, and hosted deployment pass.

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
