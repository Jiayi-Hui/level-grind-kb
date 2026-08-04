# Tencent Cloud Migration Plan

## Target

Move shared Level Grind data from the temporary Supabase path to Hong Kong
Tencent Cloud services without changing Clerk identities, sessions, roles, or
invitations.

## Target stack

- EdgeOne: public domain, TLS, routing and edge protection.
- TencentDB for PostgreSQL: shared structured data and private AskAI history.
- COS: Notes, reports, Excel files, images and immutable source files.
- Hong Kong CVM/Lighthouse API worker: authenticated API, parsing/indexing jobs,
  and market-data refresh jobs.

## Agent-owned work

1. Produce TencentDB schema and additive migration SQL.
2. Produce Supabase export/import scripts with checksums and dry-run mode.
3. Produce COS sync script with manifest, byte count and SHA-256 verification.
4. Map every record owner to Clerk `user_id`; retain email only as display/
   compatibility metadata.
5. Add cross-user read-back, ACL, soft-delete, version-conflict and file
   integrity checks.
6. Prepare API worker deployment and EdgeOne routing configuration.
7. Prepare rollback instructions and a release evidence report.

## User-owned control points

- Confirm the Tencent Cloud resource purchase and billing impact.
- Create or authorize the Hong Kong TencentDB/COS/CVM resources in the console.
- Put secrets into server-side environment variables; never paste them into
  chat or commit them:
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TENCENTDB_URL`, `TENCENTDB_PASSWORD`,
  `COS_SECRET_ID`, `COS_SECRET_KEY`, and the existing Clerk server secret.
- Approve the final production cutover after read-back verification.

## Migration gates

1. Dry-run export: no remote mutation.
2. Create target resources and apply schema.
3. Import into an isolated target namespace.
4. Verify row counts, ownership mapping, object checksums, ACLs and cross-user
   visibility.
5. Shadow-read from Tencent services while Supabase remains untouched.
6. User approves cutover; then switch EdgeOne API routing.
7. Keep Supabase export and rollback route until the first verified release.

No dual-write is allowed and no Clerk re-invites are allowed.
