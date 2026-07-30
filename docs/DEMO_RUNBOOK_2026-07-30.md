# Level Grind PM Demo Runbook — 2026-07-30

## Demo thesis

Level Grind is the team research workspace. The Event DB is its decision layer:
it turns incoming claims into a comparable history of events, price reactions,
and falsifiable investment read-throughs.

## Eight-minute path

1. **Open Event DB / 事件研究**
   - Search `国产算力` to demonstrate semantic retrieval: the result set should
     include 910/950, domestic AI-chip, testing, and supercomputing-related
     Claims even when the exact phrase does not appear.
   - The first semantic search may take several seconds while the browser loads
     and caches the local open-source BGE model. Wait until the status reads
     `本地 BGE 向量检索`.
   - Search `DeepSeek`, `TSMC`, or a ticker to demonstrate exact entity search.
   - Filter by shock type and demand state.
2. **Select one historical analogue**
   - Read T+1/T+5/T+20, drawdown, breadth, benchmark-relative price path,
     sector dispersion, and individual-security reactions.
   - Explain that “投资含义” is a research stance plus verification conditions,
     not an automatic trade.
3. **Send the prepared message to WeChat Bot**
   - The existing bridge hands the message to Codex.
   - Codex submits the structured payload to Claim Inbox.
4. **Watch the live Claim band**
   - The page refreshes Event and Claim state every three seconds.
   - The new message appears without refreshing or rebuilding the site.
5. **Open 实时 Claim Inbox**
   - Show source, speaker, time, company/ticker guess, and unverified status.
   - Explain that verification links the Claim to an Event without overwriting
     the original statement.
6. **Click 用 AskAI 深入研究**
   - The selected event is handed into the canonical AskAI workspace for
     cross-checking against reports, internal knowledge, Event DB, and web.

## Prepared demo message

Use a non-sensitive statement with an obvious company and a message id that is
new for the rehearsal:

```text
TSMC management commentary suggests AI accelerator demand remains strong, while
non-AI end demand is still mixed. Please add this as an unverified claim and
compare it with prior AI ROI and guidance-reset events.
```

Structured bridge payload:

```json
{
  "messageId": "demo-20260730-001",
  "text": "TSMC management commentary suggests AI accelerator demand remains strong, while non-AI end demand is still mixed.",
  "sentAt": "2026-07-30T09:00:00+08:00",
  "sender": "Anna",
  "company": "TSMC",
  "ticker": "2330 TT",
  "claimType": "interpretation",
  "confidence": "medium",
  "sourceDetail": "PM demo message from the connected WeChat Bot."
}
```

## Bridge contract

Local-only environment values:

```text
LEVEL_GRIND_CLAIM_INBOX_URL=https://<host>/api/claims/inbox
CLAIM_INGEST_SECRET=<same long random secret configured in the hosted runtime>
```

Publish a prepared payload:

```text
npm run claim:inbox -- /absolute/path/claim.json
```

Never put the real secret in Git, WeChat, a screenshot, or a demo slide.

## Failure fallback

- If WeChat delivery is delayed, replay the exact prepared payload through the
  local bridge. Explain that the same idempotent message id prevents duplicates.
- If the hosted API is unavailable, show the already-populated historical event
  research and the Claim Inbox contract; do not improvise with sensitive data.
- If Mainland access is unstable, use the tested network/VPN fallback and state
  that EdgeOne routing is being validated separately from the product workflow.
