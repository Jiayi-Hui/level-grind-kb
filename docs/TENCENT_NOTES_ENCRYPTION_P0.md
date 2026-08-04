# Tencent Notes encryption and audit contract (P0)

Shared Notes are a TencentDB PostgreSQL + COS service boundary. EdgeOne keeps
the existing Clerk session and forwards the user token, but it does not hold a
database password, application-encryption key, or Note plaintext.

## Encryption

- Each Note body is encrypted using AES-256-GCM before it is written to
  TencentDB. TencentDB retains only ciphertext, IV, authentication tag and an
  encryption-version marker; it never receives a plaintext `body_markdown`.
- The encryption key is a server-side deployment secret (`NOTES_MASTER_KEY_B64`)
  available only to the Notes service. It is not checked into Git, returned by
  APIs, embedded in EdgeOne, or sent to the browser.
- This P0 deliberately has **no KMS dependency**. The service fails closed when
  its application-encryption key is absent, malformed or cannot decrypt a
  record. It never downgrades to plaintext.
- Key rotation requires a versioned read/decrypt/re-encrypt migration plus a
  verified backup and recovery procedure before production is enabled.
- COS source objects use the same service boundary. The first Notes slice has
  only the encrypted-file metadata contract; DOCX/PDF/XLSX upload and parser
  execution are not yet enabled.

## Per-Note controls

Every Note stores these plaintext policy fields (not research body content):

- `sensitivity_level`: public / internal / confidential / restricted
- `ai_processing_allowed`
- `external_search_allowed`
- `download_allowed`

The future AI and download endpoints must call the Notes service access route
before releasing body content. External search requires both AI processing and
external-search permission.

## Audit

`research_audit_log` records view, create, update, soft-delete, download and
AI-use operations with actor, version and safe metadata. It must not contain
Note plaintext, ciphertext, encryption keys, authorization tokens or prompts.

## Deployment gate

Do not deploy this slice until all of the following are true:

1. `infra/tencent-postgres/001_notes_p0.sql` is applied to TencentDB.
2. A 32-byte application encryption key is assigned to the Notes service only,
   with documented custody, rotation and break-glass recovery.
3. Existing Clerk invite/manager allowlists are populated in the service
   environment; there is no alternate invite mechanism.
4. COS bucket access is private and limited to the service identity.
5. Cross-user, denied-AI, denied-download, audit, and encryption-key-unavailable tests
   pass in a non-production Tencent environment.
