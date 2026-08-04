# OpenRouter pilot configuration

OpenRouter is wired as a server-side, allowlisted provider. The repository must
never contain the real API key.

## Configure after the interface smoke test

Add these as EdgeOne/server secrets or the equivalent worker environment values:

```text
OPENROUTER_API_KEY=<paste in the Tencent console, not in GitHub or chat>
OPENROUTER_DEFAULT_MODEL=<one approved model id>
OPENROUTER_ALLOWED_MODELS=<comma-separated approved model ids>
OPENROUTER_THINKING_MODELS=<subset of approved ids that support reasoning>
# Optional, for usage estimates only (USD / 1M tokens):
OPENROUTER_MODEL_PRICES_USD_PER_MTOK={"provider/model":{"input":0,"output":0}}
OPENROUTER_ALLOW_INTERNAL_DATA=false
OPENROUTER_HTTP_REFERER=https://www.level-grind.com
OPENROUTER_APP_TITLE=Level Grind
```

Keep `OPENROUTER_ALLOW_INTERNAL_DATA=false` for the first release. Internal
Notes, claims, WeChat-derived evidence, BBG/Dymon data, and AI Capex context
continue to use the team default DeepSeek path. OpenRouter is only enabled for
an explicitly allowlisted model and a request with no internal context.

Every request is logged with provider, model, thinking state, token counts,
latency, status, request id, and estimated cost. The cost is calculated from
the server-side price schedule and is an estimate, not a billing export. Do not expose the key or a
free-form model picker to ordinary users. OpenRouter documents a large model
catalog and latency/throughput/pricing metadata, but Level Grind should expose
presets after a model has passed the team's data and latency checks.
