# Delivery — Multi-user Alpha

## Summary

Level Grind now adds a durable conversation-routing layer to personal, team, and task context. Users can save a routing rule and a concise handoff when a chat should continue, move to a new chat, or become a new project.

The current Alpha increment replaces the environment-only access list with persistent D1 team membership, owner/admin/member roles, suspension enforcement, and an in-product team access panel.

The V4 storage increment is now published. Report PDFs use the hosted R2
`FILES` binding; report metadata, extracted page text, and per-user AI usage use
the hosted D1 `DB` binding. The report assistant can switch among DeepSeek,
GLM, and Kimi using server-side runtime settings.

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

## Verification

- Typecheck, lint, build, automated tests, migration inspection, unauthorized API probe, and local persistence probes passed.

## Known Limitations

- Clerk production keys and owner bootstrap still need to be set before Gmail
  sign-in can be validated end to end.
- The model adapter is configured for DeepSeek V4 Flash, but calls remain
  disabled until a server-side `AI_API_KEY` is added.
- Retrieval is keyword-grounded in this Alpha; embeddings and hybrid/vector
  ranking are a later quality layer.
- Scanned/image-only PDFs still require OCR.
- No external chat connector, knowledge graph, or autonomous agent execution.
- No two-way Obsidian sync or Excel runner.
- No Quant research computation in the web application.
- Automatic topic-shift detection needs an approved chat-history connector.
- GitHub sync moves source and schemas, not D1/R2 content.

## Follow-Up

1. Configure Clerk keys and `LEVEL_GRIND_OWNER_EMAIL` in Sites.
2. Add a small, capped DeepSeek API balance and store `AI_API_KEY` as a secret.
3. Verify owner bootstrap, import one report, and ask one cited question.
4. Import the remaining validated CNINFO batch after the one-report runtime test.
5. Add an approved conversation connector and drift-classification service.
6. Build governed Obsidian and company-AVD connectors.
