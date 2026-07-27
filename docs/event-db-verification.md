# Event DB verification contract

The Event DB is a source-backed research memory, not a direct import of analyst
brainstorming notes.

## Source hierarchy

An event can become canonical only when it is defined by evidence from one or
more source systems:

1. Company disclosure, official announcement, filing, transcript, or exchange
   notice.
2. Bloomberg Desktop API data: security identity, price reaction, financial
   fields, consensus fields, and historical time series.
3. Dymon MCP evidence: sell-side or bank research, marketview notes, Bloomberg
   chat, mail, or curated internal research.
4. Analyst seed lists, OCR notes, and group-chat summaries.

Items from level 4 are search briefs. They can create verification tasks, but
they must not be treated as confirmed events.

## Two-layer model

The Event DB has two logical layers:

1. `candidate`: unverified event candidates. These can come from WeChat/group
   chat discussion, OCR notes, or analyst seed lists. They are useful because
   they tell the system what to search for, but they are not facts yet.
2. `verified`: source-backed events. Verified events can be backed by either
   internal analyst verification or public/source-system evidence.

## Status and verification-kind semantics

- `unverified`: imported from a seed list or rough analyst hypothesis.
- `partially_verified`: at least one independent source supports the event
  family, ticker, date window, or market reaction, but the exact metric/claim is
  not fully tied to primary evidence.
- `confirmed`: a primary or high-confidence evidence chain supports the
  canonical event definition and core metric values.
- `denied`: later source evidence contradicts the event.
- `expired`: time-sensitive rumor/forecast was not confirmed by its effective
  period.

`verification_kind` records how the event was verified:

- `candidate`: not verified yet; usually from WeChat/group chat/seed list.
- `internal`: internally verified by an analyst, channel check, supply-chain
  check, or other team-controlled verification.
- `public`: verified through Dymon MCP, Bloomberg Desktop API, company
  disclosure, exchange filing, sell-side/bank research, or public source.
- `mixed`: both internal and public/source-system evidence exist.

## Canonical event definition

Use the source-backed event definition, not the wording from a seed list. A
canonical event should answer:

- What happened?
- Which company/security/sector is affected?
- When did it happen, and what effective period does it affect?
- Which metric changed versus prior expectation, consensus, guidance, or
  bogey?
- Why does it matter for earnings, FCF, margins, valuation, or positioning?
- What source backs it?

## Dymon / BBG routing

- Use `bbg-desktop` for ticker normalization, current/reference fields,
  historical price reaction, and market/consensus data.
- Use `dymon-mcp` for marketview, sell-side/bank research, Bloomberg chat, mail,
  and qualitative verification.
- Preserve source metadata and keep raw licensed/internal content out of public
  docs and GitHub.
