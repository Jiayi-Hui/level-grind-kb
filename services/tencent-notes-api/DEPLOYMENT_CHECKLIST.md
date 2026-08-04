# TencentDB Notes / Ideas P0: deployment checklist

This is the production path for shared Notes and Idea Book data. It is designed
for the Tencent Hong Kong stack: EdgeOne is the browser-facing gateway,
CloudBase Run (or a Hong Kong CVM container runtime) runs this service, and
TencentDB for PostgreSQL is the authoritative database.

Do not deploy by copying a local `.env` file, browser storage, Supabase data,
or any generated secret into Git.

## 1. Provision the target before touching traffic

1. Create a private TencentDB PostgreSQL instance and private network access
   from the container runtime. Do not expose port 5432 to the internet.
2. Create a least-privilege database role for this service. It needs schema and
   data permissions only for the `research_*` tables.
3. Confirm the database supports `pgcrypto`, which is required for UUID
   defaults in `001_notes_p0.sql`:

   ```sql
   SELECT extname FROM pg_extension WHERE extname = 'pgcrypto';
   ```

   If the extension is absent and the service role may not create extensions,
   enable it through the TencentDB administrator path before migration. Do not
   substitute a production database with a local Docker database.
4. Create a private secret set in the chosen Tencent runtime. Values must never
   appear in a deployment manifest, EdgeOne variable file, screenshot, Git
   history, or browser bundle.

Required runtime variables:

| Variable | Rule |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | TencentDB private TLS connection string |
| `DATABASE_SSL` | `true` |
| `CLERK_SECRET_KEY` | Existing production Clerk server secret |
| `CLERK_AUTHORIZED_PARTIES` | Exact deployed Level Grind origins |
| `LEVEL_GRIND_OWNER_EMAIL` | Existing owner identity |
| `LEVEL_GRIND_INVITED_EMAILS` | Existing invited-team allow list |
| `NOTES_MASTER_KEY_B64` | Canonical base64 encoding of exactly 32 random bytes |
| `NOTES_INGESTION_ENABLED` | `false` |
| `NOTES_PARSER_LOCAL_DEV_BYPASS` | `false` |
| `NOTES_OBJECT_STORE_DRIVER` | `cos` |
| `COS_REGION` | Hong Kong COS region |
| `COS_BUCKET` | private bucket name |

`CLERK_JWT_KEY`, `DATABASE_SSL_REJECT_UNAUTHORIZED=true`,
`LEVEL_GRIND_MEMBER_MANAGER_EMAILS`, and `PG_POOL_MAX=8` are recommended.

Validate the secret set in the target runtime without printing it:

```sh
node scripts/verify-notes-deployment-env.mjs --strict
```

## 2. Key generation and staged AES rotation

Generate a 32-byte AES key locally in a secure terminal or secret manager,
then place it directly in the Tencent runtime secret store. Never send it in
chat or commit it. The example in `.env.example` is intentionally for local
generation only.

The service supports a staged key ring for rotation:

1. Add `NOTES_MASTER_KEYS_JSON` with both current and new key versions, and
   retain `NOTES_ACTIVE_KEY_VERSION=1`. Verify old Notes/Ideas still decrypt.
2. Deploy that key ring, then change only `NOTES_ACTIVE_KEY_VERSION=2`.
   New records use key version 2; records encrypted with version 1 remain
   readable.
3. Rewrap every version-1 record with an audited maintenance job before
   removing key version 1. That rewrap job is **not part of P0 yet**, so do not
   retire an old key in this release. Keeping both versions is safe and is the
   required current rollback path.

## 3. Build, migrate, then release

Build from the repository root; the Dockerfile deliberately copies source from
the repository-relative service path:

```sh
docker build -f services/tencent-notes-api/Dockerfile -t level-grind-notes-api:<immutable-version> .
```

Before a production route is enabled, run the ordered Notes/Ideas migrations:

```sh
node services/tencent-notes-api/scripts/migrate.mjs
```

The migration runner applies `001_notes_p0.sql` then
`002_note_idea_attachments.sql`. `infra/shared-data/postgres/002_claim_price_refresh.sql` is for the future
shared Claims/price schema. Do **not** run it as part of this P0 unless that
schema and its prerequisite Claims tables have separately been deployed.

Deploy the immutable image to the Hong Kong runtime with private TencentDB
network access. The process listens on port `8080`, runs as the non-root `node`
user, and has a liveness health check at `/health`.

Only after `/ready` succeeds, set EdgeOne server-side variables to point the
existing shared Notes/Ideas gateway at this service. Do not put `DATABASE_URL`,
`CLERK_SECRET_KEY`, or encryption keys in EdgeOne/browser variables.

## 4. Post-deploy gate and rollback

Set the two URLs from a trusted internal runner and execute:

```sh
NOTES_SERVICE_HEALTH_URL=https://notes.internal.example/health \
NOTES_SERVICE_READY_URL=https://notes.internal.example/ready \
node scripts/smoke-notes-service.mjs
```

`/health` proves the process is alive. `/ready` additionally proves TencentDB
connectivity and encryption initialization. Then test one invited Clerk user
through the EdgeOne gateway: list, create, update with the returned `version`,
and soft-delete a test Note. Confirm the audit row has no body plaintext.

Rollback the route/image if readiness, authentication, or an encrypted read
fails. The P0 SQL migration is additive, so routing back to the prior app image
does not require dropping tables. Do not rotate or remove encryption keys while
rolling back.

## Current P0 boundaries

- Notes/Ideas and audit metadata are shared TencentDB data; raw body/thesis is
  encrypted before PostgreSQL receives it.
- Browser document parsing and browser-side file persistence are not a
  production path. Attachment bytes go browser → private COS; PDF/DOCX/TXT/MD
  parsing happens in the authenticated Notes service and extracted text is
  encrypted before PostgreSQL persistence.
- Image-only PDF OCR, a fully detached asynchronous parser worker,
  re-encryption/rewrap, and the shared Claim/price worker each require their
  own approved deployment change and audit path.
