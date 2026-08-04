# Tencent Notes API

Deploy this small container in Tencent CloudBase Run or another Hong Kong
container runtime that can reach TencentDB for PostgreSQL. EdgeOne calls it
through `NOTES_SERVICE_BASE_URL`; browsers never receive database credentials.

Required environment variables:

- `DATABASE_URL`: TencentDB PostgreSQL connection string.
- `CLERK_SECRET_KEY`: the existing Level Grind production Clerk secret.
- `LEVEL_GRIND_OWNER_EMAIL`: Jiayi's Level Grind owner email.
- `LEVEL_GRIND_MEMBER_MANAGER_EMAILS`: comma-separated member managers.
- `LEVEL_GRIND_INVITED_EMAILS`: the existing comma-separated invited-team list.
  The service fails closed for email addresses outside this existing allowlist;
  do not create a second invitation flow here.
- `NOTES_MASTER_KEY_B64`: an exact 32-byte base64 deployment secret. It is used
  only in application memory to AES-256-GCM-wrap per-record keys.

Recommended environment variables:

- `CLERK_JWT_KEY`: production Clerk PEM public key for networkless JWT checks.
- `CLERK_AUTHORIZED_PARTIES=https://www.level-grind.com,https://level-grind.com`
- `DATABASE_SSL=true`
- `DATABASE_SSL_REJECT_UNAUTHORIZED=true`
- `PG_POOL_MAX=8`

Apply `infra/tencent-postgres/001_notes_p0.sql` before routing production
traffic. Health check: `GET /health`; readiness: `GET /ready`. The service independently verifies the
Clerk session, rejects banned/locked users, and authorizes shared mutations.

The service refuses to start unless encryption is configured. Notes and Ideas
use a new AES-256-GCM key and nonces per record; their data keys are wrapped in
application memory by `NOTES_MASTER_KEY_B64`. AES additional authenticated data
binds ciphertext to team, record type, record ID and key version, preventing
cross-record substitution. PostgreSQL stores ciphertext, nonces, tags and
wrapped keys, never plaintext `body` or `thesis`. Audit records capture
actor/action/version and safe metadata only; they never store note text,
ciphertext, API keys, or Clerk tokens.

This P0 supports shared Notes, Ideas and Note-Idea links with optimistic
version checks, soft deletion and append-only auditing. COS source-file upload
and server-side parsing are implemented but remain frozen by default
(`NOTES_INGESTION_ENABLED=false`) until the private bucket, SCF runtime and
two-user staging checks are complete. No browser upload can silently create
cloud objects when configuration is missing.

## Persistent attachment contract

When the approved ingestion gate is enabled, `POST /v1/notes/:id/attachments`
(or Ideas) creates an attachment row, opaque server-generated object key and a
short-lived signed COS `PUT` URL. The browser uploads bytes directly to COS
with the returned `Content-Type` and `x-cos-meta-sha256` header, then calls
`POST /v1/attachments/:id/complete`. The service verifies COS HEAD metadata,
downloads once to recompute SHA-256, parses PDF/DOCX/MD/TXT, and AES-256-GCM
encrypts extracted text before persistence. It records upload/parse jobs,
versions, soft deletions, retries and append-only audit metadata.

Set `NOTES_OBJECT_STORE_DRIVER=cos`, `COS_BUCKET`, `COS_REGION`, and use an SCF
execution role whenever possible. SCF custom-image temporary credentials are
read from its per-request credential headers; explicit server-only credentials
are a fallback for other Tencent runtimes. Configuration missing or invalid
fails closed; permanent SecretId/SecretKey never reaches EdgeOne or the
browser. `local` storage exists only for non-production development/tests.
The 25 MB limit applies to the COS object; EdgeOne/SCF only carries small JSON
init/complete/status requests, not file bytes.

## Ephemeral server-side document parsing

`POST /v1/documents/parse` accepts one authenticated `multipart/form-data`
field named `file` (PDF, DOCX, TXT or MD; 25 MB maximum). It parses only in
the container and returns temporary extracted text and parse metadata; it does
not create a Note, database row, background job, COS object, or audit payload.
PDF is extracted with `pypdf`; an image-only PDF returns `status: ocr_required`
and an `OCR_REQUIRED` warning. Password-protected and corrupt PDFs return a
specific error. DOCX uses `python-docx`; TXT/MD are decoded as UTF-8 then
GB18030. The endpoint always calls the existing Clerk + membership verifier and
is not enabled as an anonymous production upload.

## Daily Claim price refresh

`node price-refresh-worker.mjs` is a portable, database-backed worker for the
future TencentDB shared-research schema. It pulls Yahoo Finance daily bars,
uses each security's exchange timezone plus actual observed sessions to derive
the agreed base/T+0/T+1/T+3/T+5 window, and upserts both bars and window
results. Missing future sessions remain `pending`; zero/non-positive prices are
discarded so a bad feed cannot create a -100% return. Each run/failure/source
timestamp is recorded by `infra/shared-data/postgres/002_claim_price_refresh.sql`.

Until TencentDB is provisioned, a scheduled GitHub Action may run this worker
only against a non-sensitive development database and should never become the
production data store. Production ownership is a Tencent CloudBase/SCF timer
with `DATABASE_URL` injected as a secret; it runs after market closes and does
not require any browser to be open.

### Tencent production timer contract

The schedule runs the same container/code that serves Notes; it does **not**
run in EdgeOne or in an analyst's browser.

1. Apply the shared-research database migrations in this order to the same
   TencentDB database: `infra/shared-data/postgres/001_shared_research.sql`,
   `infra/shared-data/postgres/002_claim_price_refresh.sql`, then any approved
   later additive migration. `infra/tencent-postgres/001_notes_p0.sql` alone
   is not enough: it creates Notes/Ideas tables but not Claims or price tables.
2. Build the image after the worker files are included. A CloudBase Run/CVM
   job may use command `node price-refresh-worker.mjs`; a serverless timer may
   use handler `price-refresh-handler.main_handler`.
3. Inject only `DATABASE_URL`, `DATABASE_SSL=true`, and `NODE_ENV=production`
   as server-side runtime variables. Do not put database credentials in
   EdgeOne, a browser build, a job event, or GitHub.
4. Configure one Hong Kong-time timer every hour. It uses each ticker's
   exchange timezone and actual Yahoo sessions, so the same run safely handles
   US/HK/China listings. The PostgreSQL advisory lock makes overlap or retry
   exit safely as `PRICE_REFRESH_ALREADY_RUNNING`; repeated runs update only
   provider observations that are actually available.
5. Run `DATABASE_URL=… DATABASE_SSL=true NODE_ENV=production npm run
   price-refresh:preflight` before deployment; it checks only variable presence
   and checked-in wiring, never connects or prints values. After deployment,
   inspect the job's safe `refreshed` / `failed` counts and the
   `price_refresh_runs` table.

The exact private timer trigger, required token and rollback instructions are
in [PRICE_REFRESH_DEPLOYMENT.md](./PRICE_REFRESH_DEPLOYMENT.md). The handler
requires `PRICE_REFRESH_ENABLED=true` plus a matching
`PRICE_REFRESH_TRIGGER_TOKEN`; never give it an HTTP trigger.

Tencent documents CloudBase/SCF timer triggers as managed cron-based function
execution; use the platform's timer rather than a `setInterval` in the web
service. See [CloudBase cloud functions](https://cloud.tencent.com/document/product/876/46899)
and [SCF timer triggers](https://intl.cloud.tencent.com/zh/document/product/583/9708).

## Local verification

Copy `.env.example` to an untracked `.env.local`, start local PostgreSQL with
`docker compose -f services/tencent-notes-api/docker-compose.yml up -d`, then
run `node services/tencent-notes-api/scripts/migrate.mjs`. Synthetic fixtures
are opt-in only: `ALLOW_SYNTHETIC_FIXTURES=true node .../seed-synthetic.mjs`.
Never use those fixtures in a production database.
