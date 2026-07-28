# Level Grind handover — work computer, 2026-07-28

## Start here

Repository: `https://github.com/Jiayi-Hui/level-grind-kb`

Active branch: `add-clerk-auth-alpha`

On the company computer:

```powershell
git clone https://github.com/Jiayi-Hui/level-grind-kb.git
cd level-grind-kb
git switch add-clerk-auth-alpha
git pull --ff-only
node --version
npm ci
Copy-Item dev.vars.example .dev.vars
npm run backup:verify -- data/production-backup/2026-07-28
```

Node.js must be 22.13 or newer. Edit `.dev.vars` locally with the Clerk,
DeepSeek, and Tavily values from their dashboards. Never commit `.dev.vars`.

Start the local site:

```powershell
npm run dev
```

Open the local URL printed by the terminal. Local development uses project-local
Cloudflare-compatible D1 and R2 state under ignored `.wrangler/` files. It does
not modify production data.

The production snapshot is already in
`data/production-backup/2026-07-28/`. You do not need to find or re-upload the
current reports, workbooks, knowledge records, or AskAI history.

Before handing work back:

```powershell
npm test
git status
git add <only the intended files>
git commit -m "Describe the change"
git pull --rebase github add-clerk-auth-alpha
git push github add-clerk-auth-alpha
```

## What is portable

The visual layout is normal React/CSS and does **not** depend on ChatGPT Sites.
Moving the site does not alter the interface.

The current backend does depend on a Cloudflare Worker-compatible runtime:

- `cloudflare:workers` supplies runtime environment bindings;
- `DB` is Cloudflare D1;
- `FILES` is Cloudflare R2;
- `.openai/hosting.json` tells Sites how to attach those resources;
- Vinext builds the Next-style application as a Cloudflare Worker.

Therefore:

1. UI, Excel parsing, event logic, tests, and local development can continue on
   any computer immediately.
2. A full Tencent Cloud application deployment is not only a DNS change. It
   needs either a Cloudflare-compatible runtime or storage adapters replacing
   D1/R2 with PostgreSQL/SQLite and S3/COS.
3. A Hong Kong reverse proxy is the shortest access experiment because it keeps
   the existing Worker, D1, R2, and secrets unchanged. The prepared package is
   in `deploy/tencent-hk-mirror/`.

## Hosting choices

### A. Hong Kong reverse proxy — fastest validation

Use `deploy/tencent-hk-mirror/` on a Tencent Cloud Hong Kong Ubuntu server.
This preserves the exact UI and current cloud data. It should be tested with
one invited Mainland user before changing the main domain.

This route can still fail if Clerk's browser endpoints are unavailable from the
Mainland network. If that happens, use a production Clerk custom domain or
replace Clerk with the company's Microsoft identity provider.

### B. Independent Cloudflare deployment

Copy `wrangler.example.jsonc` to `wrangler.jsonc`, create a new D1 database and
R2 bucket, configure secrets, and deploy the Worker independently of Sites.
This removes the `chatgpt.site` origin but Cloudflare reachability from Mainland
China still needs real-network testing.

### C. Full Tencent Cloud application

Keep the React UI and domain. Replace the storage/runtime boundary:

- D1 → PostgreSQL/MySQL/SQLite adapter;
- R2 → Tencent COS or S3-compatible object storage;
- `cloudflare:workers` environment access → a portable server environment
  adapter;
- Clerk → production Clerk custom domain or company Microsoft identity.

This is the most independent route, but it is a backend migration rather than a
simple hosting toggle.

## Current product state

### Working

- Clerk login plus D1 team membership.
- Personal/team knowledge with exact-duplicate merging, edit, and delete.
- Report library, R2 files, D1 page text, loading state, and filters.
- Project/chat research Q&A with DeepSeek, Tavily, citations, saved history, and
  live usage estimation.
- Event/Claim/Team Notice seed model.
- Excel upload, registry, export, and standard-template mapping.
- Responsive UI and custom domain.

### Demo blockers

1. **Excel model understanding**
   - The current parser maps a known standard workbook structure.
   - It does not yet infer arbitrary analyst workbooks reliably.
   - Acceptance: one real workbook exposes recognizable assumptions, outputs,
     formulas, sources, and version history, then exports without workbook
     damage.

2. **Event price reaction**
   - Event seeds do not yet contain corresponding market moves.
   - Add BBG/MCP-derived T+1, T+5, and T+20 returns, benchmark returns, excess
     returns, observation timestamps, and source identifiers.
   - Keep market reactions separate from the Event fact itself so they can be
     recomputed.

3. **Mainland access and login**
   - Do not invite the full team until desktop and mobile login work without a
     VPN for at least two invited Mainland users.

## Suggested Event market-reaction record

Keep this as a child record keyed to `event_id`, not as free text on the Event:

```text
event_id
ticker
exchange
benchmark_ticker
event_timestamp
price_timestamp
return_t1
return_t5
return_t20
benchmark_return_t1
benchmark_return_t5
benchmark_return_t20
excess_return_t1
excess_return_t5
excess_return_t20
currency
source_system
source_identifier
observed_at
```

BBG values should be stored with their actual observation date and ticker
convention. Do not put Bloomberg credentials, terminal exports with restricted
redistribution terms, or raw internal chats in Git.

## Data included in GitHub

Tracked and portable:

- `data/production-backup/2026-07-28/d1/tables/*.json`: all 25 production D1
  application tables, 6,555 rows in total;
- `data/production-backup/2026-07-28/r2/objects/`: all 45 production R2
  objects, 82,033,505 bytes in total, with original keys and metadata retained
  in `manifest.json`;
- `data/production-backup/2026-07-28/reports/pdfs/`: 30 reconstructed,
  directly openable report PDFs;
- `data/production-backup/2026-07-28/reports/page-text/`: the same 30 reports
  grouped into per-report, per-page JSON text;
- `data/production-backup/2026-07-28/manifest.json` and `SHA256SUMS`: row
  counts, object keys, byte sizes, metadata, and SHA-256 verification data;
- `data/events/*.json` and generated SQL: sanitized Event, Claim, Team Notice,
  taxonomy, and verification seed data;
- `public/*.xlsx`: the simple valuation workbook and SpaceX demo workbook;
- `drizzle/*.sql`: database migrations;
- `scripts/`: seed generation and public CNINFO retrieval/import tools;
- product code, tests, deployment examples, and documentation.

The snapshot specifically includes:

- 4 personal/team knowledge records plus their context/scope rows;
- 3 research projects, 3 chats, 6 messages, and 3 saved research queries;
- 30 report records, 30 PDFs, and 6,218 extracted page chunks;
- 2 uploaded model workbooks, model catalogue rows, and change-log/parser
  state (the current parser produced zero mapped model variables, which is the
  actual production state rather than omitted data);
- the current member, personal profile, user preference, AI usage, and web
  search usage rows;
- all production R2 report parts and uploaded Excel workbooks.

Still not included:

- Clerk, DeepSeek, Tavily, Cloudflare, Bloomberg, or Dymon secrets;
- raw WeChat messages and private source files;
- local `.wrangler/`, `.dev.vars`, and build output.

GitHub now contains both the source relay and a point-in-time production
backup. It is not an automatically updating mirror: run a new export before a
later production migration if users have added data after 2026-07-28.

## Verify or restore the production snapshot

Verify every raw and materialized artifact:

```powershell
npm run backup:verify -- data/production-backup/2026-07-28
```

Generate a reviewable D1 restore SQL file without writing to any cloud:

```powershell
npm run backup:restore -- data/production-backup/2026-07-28
```

To restore into separately created Cloudflare resources after reviewing the
plan:

```powershell
npm run backup:restore -- data/production-backup/2026-07-28 --database <D1_NAME> --bucket <R2_BUCKET> --apply
```

The restore script recreates every D1 table/row and uploads each R2 object under
its original key. The reconstructed PDFs and page-text folders are convenient
inspection copies; raw D1/R2 directories remain the authoritative restore
source.

## Relevant files

- Main UI: `app/research-workspace.tsx`, `app/globals.css`
- Ask AI: `app/api/ask/route.ts`, `lib/research.ts`
- Events: `app/api/events/route.ts`, `lib/events.ts`, `data/events/`
- Models: `app/model-workbench.tsx`, `app/xlsx-model.ts`,
  `app/api/models/route.ts`, `lib/model-workbooks.ts`
- Storage/schema: `db/schema.ts`, `drizzle/`
- Current Sites binding: `.openai/hosting.json`
- Independent deployment notes: `DEPLOYMENT.md`, `wrangler.example.jsonc`
- Hong Kong mirror: `deploy/tencent-hk-mirror/`
- Production backup: `data/production-backup/2026-07-28/`
- Backup/export/restore tools: `scripts/export-production-backup.mjs`,
  `scripts/materialize-backup-reports.mjs`,
  `scripts/verify-production-backup.mjs`,
  `scripts/restore-production-backup.mjs`

## Recommended next-agent prompt

```text
Continue Level Grind from HANDOVER_WORK_COMPUTER_2026-07-28.md on branch
add-clerk-auth-alpha. First run npm ci, verify
data/production-backup/2026-07-28, and run npm test. The GitHub snapshot already
contains current D1 rows, R2 objects, 30 report PDFs and page text, uploaded
Excel files, knowledge records, users/preferences/usage, and AskAI history; do
not re-upload them. Then work in this order:
(1) import BBG/MCP event market reactions as a child table with T+1/T+5/T+20
and benchmark excess returns; (2) make the Excel parser understand one real
analyst workbook and preserve formulas on export; (3) validate the Tencent HK
access/login path with one invited Mainland user. Do not commit secrets, raw
WeChat data, or restricted Bloomberg exports.
```
