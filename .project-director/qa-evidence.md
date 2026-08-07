# QA Evidence

## V5.18 — Private research and responsive AskAI

- Confirmed production has Clerk, DeepSeek, Tavily, and OpenRouter secrets, but
  the prior UI showed OpenRouter as pending because no allowlist was returned.
- Confirmed localhost could not obtain a Clerk production token because the
  production Clerk instance only accepts the canonical `level-grind.com`
  origin. Local UI now proxies canonical APIs, but authenticated provider timing
  must be measured on the canonical domain after deployment.
- Removed telemetry Blob writes from the response critical path; the SSE route
  now emits an immediate ready frame, visible lifecycle stages, heartbeats,
  provider-connected state, and first visible token without exposing reasoning.
- Added an explicit built-in OpenRouter allowlist when a key exists and no
  operator allowlist is configured. Caller-supplied arbitrary model IDs remain
  rejected.
- Raw Notes/Ideas list and item reads are contributor-only. Other members do not
  receive titles, bodies, owner identities, attachments, or object keys.
- AskAI may retrieve a bounded set of server-side team records, but strips
  contributor identity, original title, attachment metadata, and long/raw text
  from the browser-facing path. The model is instructed to synthesize only the
  minimum evidence needed.
- AskAI Projects, Chats, and Messages are stored by hashed Clerk subject with a
  one-time, non-destructive local-history migration and optimistic conflicts.
- Re-prepared seven Tiff records and five attachments as Confidential,
  contributor-only raw data eligible for gray-box retrieval. Production import
  remains blocked until the owner-only code is deployed and authenticated.
- `npm run lint`: pass.
- Full Node test suite: 51/51 pass.
- `npm run build` with bundled Node 24: pass.
- `npm run edgeone-demo:build`: pass.
- No production deployment or research-data write occurred.

## V5.17 — Current Event/Idea validation

- The active portable Event ledger contains 0 legacy WeChat seed Claims while
  the internal source archive remains recoverable with 45 rows.
- New shared Events and Ideas accept an explicit listed-company ticker/Yahoo
  symbol and render a separate market-validation panel.
- The bounded Yahoo route returned 152 real `META` one-hour observations in a
  runtime probe, with provider, interval, and refresh metadata preserved.
- Market validation shows inception baseline, latest price, interval return,
  maximum observed upside, and maximum observed downside. Missing or invalid
  symbols remain blank rather than generating a return.
- Fundamental validation remains contributor/manager editable and independent
  from price refresh. Its narrative evidence and next-check fields are sealed
  with AES-256-GCM before storage; existing version, audit, and access controls
  are unchanged.
- `npm run lint`: pass.
- `npm test` with bundled Node 24: 50/50 pass.
- `npm run edgeone-demo:build`: pass.
- Browser QA at 1280 px and 390 x 844: Event starts with 0 active legacy rows;
  the Idea market/fundamental panels render with no horizontal overflow. Local
  preview without the EdgeOne API reports that limitation clearly.
- Release remains pending explicit approval; no push, deployment, Clerk change,
  or production research write occurred.

## V5.16 — Governed intake and observable AskAI

- Prepared seven private research objects in a gitignored intake workspace:
  two dated Tiff updates, two investment-memo Ideas, one weekly Note, and two
  expert-meeting Notes. Five source PDFs remain outside Git.
- Verified default policy is `Confidential`, team-viewable, non-downloadable,
  redaction-required, and not eligible for internal AI, external AI, or web
  search until reviewed.
- Enforced owner-or-manager update/delete rules and append-only metadata audit
  records for Notes, Ideas, and attachment lifecycle events.
- Added analyst contribution and PM review summaries without exposing private
  AskAI histories or allowing a team-library bulk download.
- Added SSE stages and heartbeats for auth, knowledge retrieval, web
  verification, provider connection, first token, completion, and typed errors.
- Added metadata-only stage diagnostics with request IDs; prompts, retrieved
  context, and answers are not stored in diagnostics.
- EdgeOne Cloud Function duration is configured to 120 seconds. Tavily and model
  operations have independent bounded deadlines and return visible errors.
- `npm run lint`: pass.
- `npm test` with bundled Node 22: 49/49 pass.
- `npm run edgeone-demo:build`: pass.
- Desktop and 390 x 844 mobile browser QA: Notes layout, navigation, editor,
  upload area, and contribution summaries render without horizontal overflow.
- Production data write remains intentionally pending: it requires an
  authenticated canonical-domain session after explicit release approval.
## V5.27 QA evidence

- Canonical repository: `Jiayi-Hui/investment-graph@c4c94a3b44167c8a098c57ba6dcccbd8c6ab207d`.
- Canonical package: build passed; 13 graph model/interaction tests passed.
- Level Grind: portable EdgeOne build passed; 65 tests passed; lint passed on
  Node 24.14.0.
- Browser desktop QA at `127.0.0.1:4174`:
  - default 08/06 view rendered 94 nodes, 117 relations, seven node types;
  - AI hardware + autos and A-share + Hong Kong filters remained selected
    together and rendered a connected 13-node/10-edge network;
  - playback advanced 2026-08-06 to 2026-08-03 after play was activated;
  - inspector, relationship list, source area, statistics, and legends were visible.
- Pending production evidence: migration/import receipts, production URL hash,
  and two-account raw-view comparison.
