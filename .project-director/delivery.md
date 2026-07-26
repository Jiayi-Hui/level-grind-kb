# Delivery — Multi-user Alpha

## Summary

Level Grind now adds a durable conversation-routing layer to personal, team, and task context. Users can save a routing rule and a concise handoff when a chat should continue, move to a new chat, or become a new project.

The current Alpha increment replaces the environment-only access list with persistent D1 team membership, owner/admin/member roles, suspension enforcement, and an in-product team access panel.

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
five repeated-use surfaces: Research inbox, Report library, Ask research,
History, and Settings. It adds account-persisted Chinese/English localization,
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

## Verification

- Typecheck, lint, build, automated tests, migration inspection, unauthorized API probe, and local persistence probes passed.

## Known Limitations

- Gmail/Clerk sign-in still needs a final owner-session walkthrough on the
  user's device.
- Retrieval is keyword-grounded in this Alpha; embeddings and hybrid/vector
  ranking are a later quality layer.
- Web and Hybrid modes require a separate server-side search provider key.
  DeepSeek performs synthesis; its standard API does not bundle the consumer
  app's search results.
- Scanned/image-only PDFs still require OCR.
- No external chat connector, knowledge graph, or autonomous agent execution.
- No two-way Obsidian sync or Excel runner.
- No Quant research computation in the web application.
- Automatic topic-shift detection needs an approved chat-history connector.
- GitHub sync moves source and schemas, not D1/R2 content.

## Follow-Up

1. Complete the Gmail owner-session walkthrough and persona onboarding.
2. Ask one production report question and verify citations plus usage metering.
3. Add quota visibility for the current user and owner-wide operations view.
4. Add an approved conversation connector and drift-classification service.
5. Build governed Obsidian and company-AVD connectors.
