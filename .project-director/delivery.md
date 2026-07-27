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
