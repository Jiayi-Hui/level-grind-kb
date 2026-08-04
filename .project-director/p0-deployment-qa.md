# P0 deployment / QA contract — 2026-08-03

## Operating decision

- Shared Notes and Ideas are a new TencentDB + COS contract. Existing Clerk
  instance, user IDs, invitations and role assignments remain the only identity
  authority; no feature introduces a second invitation system.
- Application AES-256-GCM encryption is the P0 design. Tencent KMS is not a
  runtime dependency for this release. The service key is server-only and has a
  documented custody, rotation and recovery owner before real ingestion.
- Production upload is **frozen by default**. The preview/demo may use only
  public, synthetic or properly de-identified fixtures, visibly labelled as
  such. A browser-only success state is never evidence of shared persistence.
- Existing Supabase, D1 and R2 are compatibility paths only. Shared Notes must
  fail closed if `NOTES_SERVICE_BASE_URL` is absent; it must not fall back to
  Supabase, D1, R2, `localStorage` or `sessionStorage`.

## Required server configuration before a staging smoke test

```text
DATABASE_URL=<TencentDB PostgreSQL connection string>
CLERK_SECRET_KEY=<existing Clerk instance secret>
CLERK_AUTHORIZED_PARTIES=https://www.level-grind.com,https://level-grind.com
LEVEL_GRIND_OWNER_EMAIL=<existing owner email>
LEVEL_GRIND_MEMBER_MANAGER_EMAILS=<existing manager allowlist>
LEVEL_GRIND_INVITED_EMAILS=<existing invited-member allowlist>
NOTES_MASTER_KEY_B64=<exact 32-byte base64 key; server only>
NOTES_INGESTION_ENABLED=false
```

`NOTES_SERVICE_BASE_URL` is an EdgeOne server variable pointing to the
authenticated Notes service. Neither `DATABASE_URL` nor `NOTES_MASTER_KEY_B64`
belongs in EdgeOne browser assets, Git, screenshots, or chat.

## Attachment / parsing release gate

The attachment gateway is deliberately a **control plane only**. EdgeOne may
forward authenticated JSON requests for the following contract, but it must
never receive PDF, Excel, image or other file bytes:

| Browser call | Required Tencent Notes service action | File path |
|---|---|---|
| `POST /api/shared-notes/:noteId/attachments` | validate Note permission; create attachment metadata; return a short-lived COS signed PUT URL and checksum policy | browser → COS directly |
| `POST .../:attachmentId/complete` | HEAD/checksum the COS object; queue parse/index job | no file bytes through EdgeOne |
| `GET .../attachments`, `GET .../:attachmentId` | list/status metadata only | JSON only |
| `POST .../:attachmentId/retry` | requeue failed parse/index job | JSON only |
| `DELETE .../:attachmentId` | soft-delete metadata; asynchronously remove or retain COS object per policy | JSON only |

The Notes container now implements attachment init, completion, list/status,
retry and soft deletion for both Notes and Ideas. It signs short-lived COS PUT
URLs, verifies object metadata and SHA-256, parses PDF/DOCX/TXT/MD in the
backend, and encrypts extracted text before persistence. The old multipart
EdgeOne parse proxy still returns an explicit unavailable response so file
bytes cannot accidentally travel through EdgeOne.

Required release-time configuration (names only; never print values):

```text
# EdgeOne server runtime
CLERK_SECRET_KEY=<existing instance secret>
NOTES_SERVICE_BASE_URL=https://<private-notes-service>

# Tencent Notes service / job runtime
DATABASE_URL=<TencentDB PostgreSQL connection string>
DATABASE_SSL=true
CLERK_SECRET_KEY=<same existing Clerk instance secret>
NOTES_MASTER_KEY_B64=<existing 32-byte server key>
LEVEL_GRIND_OWNER_EMAIL=<existing owner>
LEVEL_GRIND_INVITED_EMAILS=<existing invite allowlist>
COS_REGION=<Hong Kong COS region>
COS_BUCKET=<private bucket>
COS_UPLOAD_ROLE_OR_TEMP_CREDENTIAL_PROVIDER=<server-side only>
NOTES_INGESTION_ENABLED=true  # only after signed-URL and two-user smoke pass
```

Do not place a COS SecretId/SecretKey in EdgeOne, browser code or a client
request. Prefer a Tencent workload role / temporary credential provider in the
Notes service. The COS CORS policy should allow only the production Level Grind
origins and the exact PUT headers returned in each signed-upload policy.

## Pre-release checks

1. Run `node scripts/verify-notes-deployment-env.mjs --strict` in the Notes
   service environment. It validates names and safe defaults only; it never
   prints secret values.
2. Build the EdgeOne bundle and run the targeted Node contracts.
3. With a synthetic fixture, test owner create → second invited user refresh /
   read → owner edit → second user read-back → soft delete. Confirm the same
   Clerk accounts and roles remain valid.
4. Verify a missing Notes service returns an explicit unavailable state and no
   browser/D1/R2/Supabase data appears.
5. Before cutover, verify the production ingestion switch remains `false`;
   only set it to `true` in staging after COS CORS, execution-role credentials,
   checksum verification and two-user read-back pass.
6. Keep an export, record counts, object checksums and a route rollback before
   any cutover.
7. Before enabling attachment ingestion: browser calls attachment init → direct
   COS upload → complete → queued/ready status; a second existing Clerk user
   sees the same attachment metadata; retry and soft delete append audit-safe
   metadata. Capture no file contents, tokens or signed URLs in release notes.

## Local / staging smoke commands

```bash
node --test tests/p0-deployment-contract.test.mjs tests/shared-notes-contract.test.mjs tests/member-permissions.test.mjs
npm run edgeone-demo:build
NOTES_SERVICE_HEALTH_URL=http://127.0.0.1:8080/health node scripts/smoke-notes-service.mjs
```

The health smoke does not authenticate a user, create a Note or print any
response body. Cross-user mutation/read-back remains a separate signed-in
staging check because it requires the two existing Clerk accounts.

## Acceptance evidence to attach to release candidate

- masked environment validation output;
- EdgeOne build artifact checksum;
- targeted test output;
- two-user Clerk identity/read-back evidence using synthetic data;
- explicit confirmation that production ingestion remains disabled;
- export/rollback location and owner.
