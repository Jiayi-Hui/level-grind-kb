# AskAI streaming + OpenRouter QA — 2026-08-04

## Result

The EdgeOne AskAI path now has an end-to-end SSE contract:

1. the browser posts `stream: true` and reads `response.body` chunk by chunk;
2. the server function emits `ready`, `status`, `meta`, `delta`, `done` and
   metadata-only heartbeat events with `text/event-stream`, `no-transform` and
   `X-Accel-Buffering: no` headers;
3. the upstream DeepSeek/OpenRouter response is requested with `stream: true`
   and parsed incrementally; only answer text deltas are forwarded, never
   reasoning text;
4. the client renders partial Markdown as deltas arrive, scrolls as the last
   message changes, and shows the live phase / elapsed seconds.

## DeepSeek no-response diagnosis

The repository cannot inspect masked EdgeOne environment variables, so it
cannot prove the active deployment's missing secret or model id. The audited
failure modes were:

- the previously deployed bundle may predate the current SSE client/function
  changes; old browser code awaited one complete JSON response;
- the server used only `AI_API_KEY`, while an EdgeOne configuration may have
  used the natural `DEEPSEEK_API_KEY` name;
- in web mode, Tavily ran before the SSE response was created, causing a long
  silent wait before any byte was sent;
- a provider/edge proxy can buffer a large final event. The completion event
  no longer repeats the complete answer body; the client uses prior deltas.

The implementation accepts `AI_API_KEY` as preferred and `DEEPSEEK_API_KEY`
as a compatibility fallback, as well as `AI_MODEL` / `DEEPSEEK_MODEL`. It now
opens SSE before web retrieval and emits immediate and periodic metadata-only
frames. A real signed-in staging request remains required to prove the Tencent
edge does not buffer SSE in the active service configuration.

## Controlled OpenRouter model selection

- The client reads model capabilities with the existing Clerk token and only
  renders models returned by the server allowlist.
- POST validates the requested model against
  `OPENROUTER_ALLOWED_MODELS`; arbitrary model strings are rejected server-side.
- Only `OPENROUTER_THINKING_MODELS` may receive a reasoning request. The UI
  disables Thinking for the other approved models.
- Internal context is still blocked for OpenRouter unless the deployment owner
  explicitly turns on `OPENROUTER_ALLOW_INTERNAL_DATA=true`.
- Usage records include provider, model, effective Thinking state, input/output
  tokens, latency, Tavily credits, status, request id and estimated USD cost.
  `003_ai_usage_cost.sql` adds the estimate column without touching users,
  sessions, roles or earlier rows.

## Verification

- `node --test tests/agentic-research.test.mjs` — passed (3/3).
- `npm run lint` — passed.
- `npm run edgeone-demo:build` — passed.
- No deployment, database migration, secret entry, commit or push occurred.

## Release evidence still needed

1. In EdgeOne, keep the existing `AI_API_KEY` or `DEEPSEEK_API_KEY` masked;
   set an actual supported model id under `AI_MODEL` if it is not already set.
2. Add OpenRouter secrets only in the EdgeOne console, with a small reviewed
   model allowlist and explicit price schedule; never paste a real key into Git
   or chat.
3. Apply the additive telemetry migration only through the existing database
   release process.
4. With an existing Clerk account, verify a `ready` frame arrives promptly,
   deltas arrive before completion, and a disabled/invalid OpenRouter model is
   rejected. Capture only status/timing evidence, not prompts or credentials.

## EdgeOne pre-release smoke

SSE is implemented at the function boundary, but a local build cannot prove
the deployed EdgeOne function is not buffered by the active Tencent service
configuration. After a preview deployment, use an existing Clerk account and
run `ASKAI_SMOKE_URL=https://<preview>/api/agent-chat ASKAI_SMOKE_TOKEN=<short-lived-token> npm run askai:sse:smoke`.
The script sends a fixed benign prompt and prints only first-event, first-delta
and completion timings; it never prints the token or answer. A pass requires a
prompt `ready` event and a `delta` before completion.

## Local routing diagnosis

The `deploy/edgeone-demo` Vite server is a frontend preview, not an EdgeOne
Functions emulator. Without an explicit `VITE_AGENT_CHAT_PROXY_URL`, port 4174
now returns an intentional JSON 503 (`LOCAL_AGENT_FUNCTION_NOT_CONNECTED`) for
`/api/agent-chat`, rather than the Vite HTML fallback. This makes the browser
show a direct explanation instead of appearing to wait forever. Run
`npm run askai:route:diagnose` to inspect only the route/content type; it makes
no provider request and reveals no secret. For a local function smoke, set
`VITE_AGENT_CHAT_PROXY_URL` to an approved local emulator; for the real
product, use the authenticated EdgeOne preview/production endpoint.

The public health `GET /api/agent-chat` reports only boolean configuration
readiness for Clerk, DeepSeek, Tavily and OpenRouter. It cannot determine an
upstream account's remaining balance. A 401/403, 402, 429, or 5xx response from
the model is instead translated to an actionable auth/activation, balance,
rate-limit, or temporary-service message without exposing provider payloads.

## Local function harness (no browser secret)

`npm run edgeone-demo:dev` serves only the user interface. To test the same
AskAI function locally, start the loopback-only function harness in one terminal:

```bash
npm run askai:local:function
```

It listens at `http://127.0.0.1:8788/api/agent-chat`, loads values only from
ignored `.dev.vars` (with shell environment overrides), and prints only boolean
configuration readiness. It never reads credentials into the Vite browser
bundle, prints a key, or accepts requests from a network interface.

Start the UI in a second terminal with the explicit same-machine proxy:

```bash
VITE_AGENT_CHAT_PROXY_URL=http://127.0.0.1:8788 npm run edgeone-demo:dev
```

For an authenticated browser test, local `.dev.vars` needs an existing
`CLERK_SECRET_KEY` plus an explicit local party, for example
`CLERK_AUTHORIZED_PARTIES=https://www.level-grind.com,https://level-grind.com,http://127.0.0.1:4174`.
The Clerk Dashboard must also allow that local development origin. This change
is local-only: deployed environments retain the production two-origin default
unless an operator explicitly configures a different allowlist.

For a headless streaming smoke, use a short-lived existing Clerk session token;
it is read only from the process environment and never printed. The prompt is
fixed, contains no internal evidence, and avoids Tavily:

```bash
ASKAI_SMOKE_URL=http://127.0.0.1:8788/api/agent-chat \
ASKAI_SMOKE_TOKEN='<short-lived-clerk-token>' \
ASKAI_SMOKE_PROVIDER=deepseek \
npm run askai:sse:smoke
```

An OpenRouter smoke is separate and requires a reviewed model which is already
listed in local `OPENROUTER_ALLOWED_MODELS`; the command does not supply a key:

```bash
ASKAI_SMOKE_URL=http://127.0.0.1:8788/api/agent-chat \
ASKAI_SMOKE_TOKEN='<short-lived-clerk-token>' \
ASKAI_SMOKE_PROVIDER=openrouter \
ASKAI_SMOKE_MODEL='<allowlisted-provider/model>' \
npm run askai:sse:smoke
```

The local harness proves application wiring and SSE framing, not EdgeOne's
production buffering behavior. The latter still needs the authenticated EdgeOne
preview smoke described above.
