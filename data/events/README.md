# Event DB seed data

This folder is intentionally tracked in Git so another machine can continue the
Level Grind alpha deployment.

## Files

- `event-db-seed.json` - sanitized Event DB seed. It contains unverified
  candidates plus verification metadata, but not full raw chat/OCR/email bodies.
- `taxonomy.json` - event types, verification statuses, verification kinds, and
  tag groups.
- `verification-findings-2026-07-27.json` - first BBG/Dymon verification pass.
- `event-db-seed.sql` - generated D1 import SQL.

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
