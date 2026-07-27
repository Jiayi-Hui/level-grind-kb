# Event DB seed data

This folder is intentionally tracked in Git so another machine can continue the
Level Grind alpha deployment.

## Files

- `event-db-seed.json` - sanitized Event DB seed. It contains unverified
  candidates plus verification metadata, but not full raw chat/OCR/email bodies.
- `claim-db-seed.json` - source statements, forecasts, interpretations, and
  their typed links to Events.
- `event-notice-seed.json` - privacy-preserving records of when the team first
  surfaced each Event candidate.
- `taxonomy.json` - event types, verification statuses, verification kinds, and
  tag groups.
- `verification-findings-2026-07-27.json` - first BBG/Dymon verification pass.
- `event-db-seed.sql` - generated D1 import SQL.
- `event-knowledge-seed.sql` - generated Claim, link, and Team Notice import SQL.

## Two-layer model

- `verificationKind = candidate`: raised from analyst discussion / seed list and
  still unverified.
- `verificationKind = internal`: verified by an analyst/channel/supply-chain
  check inside the team.
- `verificationKind = public`: verified through Dymon MCP, BBG Desktop API,
  company disclosure, exchange filing, sell-side/bank research, or public
  source evidence.
- `verificationKind = mixed`: both internal and public evidence exist.

Raw sensitive material stays in `data/private/`, which is gitignored.

## Object boundary

- **Event:** a candidate or confirmed real-world change.
- **Claim:** what a specific source states, predicts, denies, or explains.
- **Claim–Event link:** whether the Claim supports, contradicts, predicts,
  explains, denies, or merely suggests the Event.
- **Team Notice:** when and how the team surfaced, questioned, challenged, or
  acted on the Event.

Claims never turn into Events and are not overwritten after verification.
`source_verified` means the source and wording were checked; it does not mean a
forecast has happened. Event verification is maintained separately.
