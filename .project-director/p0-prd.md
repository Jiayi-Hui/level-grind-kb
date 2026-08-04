# P0 PRD — Shared Notes and Idea Intake

## Objective

Move Level Grind from a file-oriented knowledge library toward an idea-tracking research database by making shared Notes the reliable intake layer and connecting Notes to reviewed Ideas.

## Users

- Analysts: upload shared Notes and search the team corpus.
- PM / approved reviewers: review Idea drafts and promote them to the active Idea Book.
- Jiayi / system operator: monitor extraction failures, resolve entity mappings, and publish structured records.

## Scope

- Shared Notes upload with durable object storage and asynchronous parsing status.
- Notes are the first release gate: a user's upload or edit must be visible to another authorized user after refresh.
- Canonical company/ticker/entity mapping across Chinese names, English names, Wind, Bloomberg, and Yahoo identifiers.
- Hybrid Notes retrieval: exact identifiers + keyword/full-text + vector retrieval, with DeepSeek used for synthesis rather than as the index.
- Idea Book draft/review/active state and Note links remain compatible at the data layer; full Idea UI and third-model processing are deferred until Notes passes cross-user acceptance.
- Audit/version metadata for uploaded files and extracted records.

## Non-Goals

- Tracker persistence and automated price/financial refresh (P1).
- Full Idea Validation, public-web evidence synthesis, quant factors, and backtests (P2).
- Realtime parsing of every analyst's file inside the browser.
- Replacing the current Event DB or AI Capex modules.

## Assumptions

- Notes may be uploaded by team members; Notes are shared by default.
- Ideas may be submitted as drafts but do not become active team Ideas until reviewed.
- The canonical production write path must be one runtime and one database contract; do not silently dual-write the EdgeOne static demo and the D1/Postgres application.
- Production ingestion is frozen by default. Before an explicit server-side
  approval, preview and QA use only public, synthetic or properly de-identified
  data; an unavailable upload is preferable to a misleading local success state.

## Requirements

- FR-1: Upload returns a durable record and visible progress without blocking the page.
- FR-2: Parser failures preserve the original file and expose retry/partial-review states.
- FR-3: Search accepts Chinese company names, English names, aliases, Wind/Bloomberg/Yahoo tickers, and natural-language queries.
- FR-4: Every Note retains uploader, source file, template, extraction status, timestamps, visibility, and version/audit metadata.
- FR-5: Idea records support Draft → PM Review → Active → Tracking → Validated/Rejected/Archived states.
- FR-6: An Idea can link to multiple Notes; a Note can support multiple Ideas.
- FR-7: Private AskAI conversations cannot leak into shared retrieval.
- FR-8: Retrieval and embedding/index refresh run in a background worker; the browser must not load model weights on first search.
- FR-9: AskAI streams output; default mode does not call web search, and an explicit Web mode enables it.
- FR-10: Every model request records model, provider, thinking setting, latency, tokens, cost, status, and timestamp.

## Acceptance Criteria

- A team member can upload a supported file and see Uploading → Processing → Parsed/Needs review/Failed.
- A failed parse can be retried without losing the original file.
- Searching a Chinese company name, English name, or ticker returns the same canonical entity's Notes.
- A draft Idea can be created, linked to Notes, reviewed, and promoted without duplicating the Notes.
- Two users see the same shared Notes and Idea state after refresh.
- Build, lint, typecheck, and focused API/UI checks pass; no fake completion or browser-only persistence is used for shared records.
