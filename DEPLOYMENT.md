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

Create one D1 database and one R2 bucket, then copy `wrangler.example.jsonc`
to `wrangler.jsonc` and replace the D1 database id, R2 bucket name, and public
Clerk key.

The application creates its D1 tables lazily from the API routes:

- `documents`
- `document_context`
- `personal_contexts`
- `task_contexts`
- `team_members`

## 3. Local verification

```powershell
npm install
$env:NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='pk_test_replace_me'
$env:CLERK_SECRET_KEY='sk_test_replace_me'
npm run build
npm run lint
```

## 4. Boundary notes

Level Grind stores context, provenance, permissions, task state, timelines, and
approved research results. Raw systems such as Obsidian, Bloomberg, Wind,
WeChat, Teams, Excel, or a separate quant stack remain outside this app unless a
future connector explicitly imports selected records.
