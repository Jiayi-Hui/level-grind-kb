# GitHub production and work-computer handover

## Canonical branches

| Branch | Purpose | Deployment |
|---|---|---|
| `production` | Exact reviewed source intended for colleagues | Push triggers Tencent EdgeOne deployment to `level-grind.com` |
| `main` | Stable daily development and integration line | No production deployment |
| `feature/*` | One bounded feature or data-contract change | No production deployment |

Historical branches remain readable but are not deployment authorities:

- `add-clerk-auth-alpha`: original full-stack Sites/D1/R2 snapshot;
- `codex/level-grind-event-demo`: pre-normalization Tencent continuity line.

Normal flow:

```text
feature/<name> -> main -> production -> GitHub Actions -> Tencent EdgeOne -> level-grind.com
```

Only merge `main` into `production` after a release check. Never develop
directly on `production`.

## Release-train discipline

Level Grind uses batched platform releases:

```text
bounded feature/fix batch
  -> feature/* implementation and targeted checks
  -> main integration and full regression
  -> release candidate with QA evidence
  -> one approved production promotion
  -> canonical-domain smoke test
```

Do not push each small visual correction or isolated bug fix directly to
production. Group related changes by one user outcome or data/API contract,
verify the combined behavior, and release them together. A production hotfix is
reserved for a security issue, authentication outage, data-loss risk, or a
blocking regression and must still receive a focused test plus post-deploy
verification.

A release candidate is ready only when:

- the batch scope and affected contracts are recorded;
- targeted tests pass during feature development;
- lint, complete tests, and the portable production build pass on `main`;
- database migrations, seed imports, and rollback/restore implications are
  reviewed;
- desktop/mobile and authenticated critical paths are checked when affected;
- `.project-director/qa-report.md` records evidence and known residual risks;
- production promotion has explicit approval.

## Automatic deployment

Workflow: `.github/workflows/production-edgeone.yml`

It performs:

1. locked dependency install;
2. portable Claim/AIDC EdgeOne build;
3. source-level tests and lint;
4. deploy to the existing `level-grind-hk-demo` Makers project.

The workflow deploys every `production` push, so the organizational control is
to keep `production` quiet: only a reviewed release-candidate promotion may
reach it.

The GitHub repository must contain one Actions secret:

```text
EDGEONE_API_TOKEN
```

The token is created in the Tencent EdgeOne Makers account and stored only as a
GitHub encrypted secret. It must not appear in `.env`, source, docs, commit
history, screenshots, or chat.

## AI Capex source locations

Research source repository:

```text
../aidc-capex-tracker
```

The raw reviewed/open Epoch inputs currently read by
`scripts/sync-aidc-capex.mjs` are:

```text
../aidc-capex-tracker/data/epoch-ai/extracted/data_centers.csv
../aidc-capex-tracker/data/epoch-ai/extracted/data_center_timelines.csv
../aidc-capex-tracker/data/epoch-ai/extracted/data_center_chip_quantities.csv
../aidc-capex-tracker/data/epoch-ai/extracted/data_center_chillers.csv
../aidc-capex-tracker/data/epoch-ai/extracted/data_center_cooling_towers.csv
../aidc-capex-tracker/data/epoch-ai/extracted/ml_hardware.csv
../aidc-capex-tracker/data/epoch-ai/extracted/ai_chip_owners/quarters_by_chip_type.csv
../aidc-capex-tracker/data/epoch-ai/extracted/ai_chip_owners/cumulative_by_chip_type.csv
```

On a computer where the research repository is elsewhere:

```text
AIDC_RESEARCH_ROOT=/absolute/path/to/aidc-capex-tracker npm run aidc:sync
```

The sync writes reviewed publishable JSON to:

```text
data/aidc-capex/dashboard.json
data/aidc-capex/manifest.json
```

The reviewed location snapshot is:

```text
data/aidc-capex-geocodes.json
```

`npm run aidc:publish` validates checksums and copies these tracked snapshots to
`public/data/aidc-capex/`. Production CI deliberately uses this portable mode,
so it does not need the sibling research repository and does not rerun network
geocoding. To refresh from research sources locally, use:

```text
npm run edgeone-demo:build:research
```

The Event DB follows the same split: production uses
`npm run claims:publish` to copy the reviewed tracked Claim ledger, while an
operator runs `npm run claims:sync` only when the adjacent `event-db` research
outputs are intentionally being refreshed.

## Shared database boundary

Do not host the shared database on either laptop. The public/sanitized pilot is
now provisioned in Supabase Singapore and is reached only through authenticated
Tencent EdgeOne server functions. Company-sensitive imports remain blocked
until the work-computer owner approves the provider, region, backup/encryption
policy, and network path.

Code and schema prepared in this repository:

```text
infra/shared-data/README.md
infra/shared-data/postgres/001_shared_research.sql
infra/shared-data/postgres/002_weekend_shared_state.sql
```

Both migrations were applied to the Singapore pilot on 2026-07-31. EdgeOne
stores `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only as masked server-side
environment variables. The service-role key must never enter GitHub, client
JavaScript, screenshots, or handoff messages. Claim overlays and AI usage
events are relational; file bytes remain outside this increment.

## First work-computer session

```bash
git clone https://github.com/Jiayi-Hui/level-grind-kb.git
cd level-grind-kb
git switch main
npm ci
npm run lint
node --test tests/*.test.mjs
npm run edgeone-demo:build
```

Confirm the production handoff point before beginning new work:

```bash
git fetch github
git log --oneline --decorate -5
```

Create a feature branch before changing code:

```bash
git switch -c feature/shared-research-api
```

Company-only work belongs on a new `feature/*` branch:

- configure the approved Azure OpenAI server-side gateway;
- connect Bloomberg/Dymon/WIND verification jobs;
- import authorized reports and team data;
- configure background workers and production secrets.

The shared pilot currently covers Claim add/edit/delete overlays, optimistic
version checks, audit rows, and DeepSeek usage events. AskAI projects/chats,
reports, model workbooks, object storage, background price refresh, and backup
automation remain the next shared-persistence increments; do not describe them
as already migrated.

Personal-Mac-only work remains:

- WeChat login, bot, message/attachment/OCR collection;
- WeChat-to-Claim-Inbox bridge;
- personal Obsidian vault integration.

The personal Mac should submit authenticated ingestion payloads to the cloud;
it must not become the production database or website server.
