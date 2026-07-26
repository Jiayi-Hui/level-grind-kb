# Level Grind alpha deployment

This branch keeps the Cloudflare direction and adds Clerk as the primary login
layer. D1 is used as the online database and R2 as the online file bucket.

## 1. Clerk

Use the Clerk application you already created:

```powershell
clerk init --app app_3GwPMCODwleSshe41uk0U86aiBx
```

Set these values locally and in the Cloudflare deployment environment:

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
CLERK_SIGN_IN_URL=/sign-in
CLERK_SIGN_UP_URL=/sign-up
CLERK_AFTER_SIGN_IN_URL=/
CLERK_AFTER_SIGN_UP_URL=/
LEVEL_GRIND_INVITED_EMAILS=you@example.com,analyst@example.com
LEVEL_GRIND_OWNER_EMAIL=you@example.com
```

Do not commit `CLERK_SECRET_KEY`.

`LEVEL_GRIND_OWNER_EMAIL` bootstraps exactly one owner into D1 on first sign-in.
After that, owners and admins manage persistent members in the Team context
screen. `LEVEL_GRIND_INVITED_EMAILS` remains an optional, fail-closed migration
path: listed users are inserted as members after a verified Clerk sign-in.

## 2. Cloudflare D1 and R2

The hosted Sites project owns one D1 database bound as `DB` and one R2 bucket
bound as `FILES`. These logical bindings live in `.openai/hosting.json`; Sites
creates and connects the real Cloudflare resources when a version is deployed.
For a separate direct Cloudflare deployment, copy `wrangler.example.jsonc` to
`wrangler.jsonc` and replace the placeholder resource identifiers.

The application includes migrations and also creates required tables
idempotently from protected routes:

- `documents`
- `document_context`
- `personal_contexts`
- `task_contexts`
- `team_members`
- `corpus_documents`
- `corpus_chunks`
- `ai_usage_events`

PDF bytes live in R2. Searchable report metadata, page text, permissions, and AI
usage live in D1.

## 3. Public model pilot

Use a normal provider API key, never a Coding Plan or interactive OAuth token.
The server supports DeepSeek, Z.AI, and Moonshot through one OpenAI-compatible
contract:

```text
AI_PROVIDER=deepseek
AI_API_KEY=...
AI_MODEL=deepseek-v4-flash
AI_BASE_URL=https://api.deepseek.com
AI_MAX_OUTPUT_TOKENS=1800
AI_INPUT_USD_PER_MTOK=0.14
AI_CACHED_INPUT_USD_PER_MTOK=0.0028
AI_OUTPUT_USD_PER_MTOK=0.28
```

Keep `AI_API_KEY` in the hosted secret store. The token-price settings are
runtime values so the cost display can be updated without a code change.

## 4. Local verification

```powershell
npm install
$env:NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='pk_test_replace_me'
$env:CLERK_SECRET_KEY='sk_test_replace_me'
npm run build
npm run lint
```

## 5. Boundary notes

Level Grind stores context, provenance, permissions, task state, timelines, and
approved research results. Raw systems such as Obsidian, Bloomberg, Wind,
WeChat, Teams, Excel, or a separate quant stack remain outside this app unless a
future connector explicitly imports selected records.
