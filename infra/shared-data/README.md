# Level Grind shared-data foundation

## Decision

The production database belongs to the cloud deployment, not to either laptop.

- The personal Mac is a development and WeChat-ingestion client.
- The work computer is the preferred provisioning and administration client
  because it has the approved company identity, Bloomberg/Dymon access, and
  Azure OpenAI credentials.
- The production database and object store must continue running when both
  computers are offline.

The first durable relational implementation uses a Singapore Supabase
PostgreSQL project reachable only through Tencent EdgeOne server functions.
The weekend pilot is limited to public or sanitized demo data. Company-sensitive
data still requires company-side approval for region, backups, network policy,
and credentials before import.

Apply `postgres/001_shared_research.sql` and then
`postgres/002_weekend_shared_state.sql`. The second migration adds shared Claim
overlays, optimistic concurrency, immutable audit entries, and privacy-minimal
AI usage events.

EdgeOne KV and Blob remain useful, but they are not substitutes for the whole
relational layer:

- Makers KV is suitable for small configuration/session state and is eventually
  consistent across edge nodes.
- Makers Blob is the object store for PDFs, Excel files, images, and exported
  Markdown.
- Claims, permissions, private chats, versions, and audit history belong in the
  relational database.

## Data ownership

| Data | Scope | Storage |
|---|---|---|
| AskAI projects, chats, messages | private to one user | relational database |
| Saved personal research notes | private until explicitly published | relational database |
| Preferences, language, research scope | private to one user | relational database |
| Obsidian vault path | device-local only | browser/device storage |
| Claims, Events, price paths | team shared | relational database |
| AI Capex projects, observations, coordinates | team shared | relational database |
| Reports and team knowledge | team shared with ACLs | metadata in database, bytes in Blob |
| Model registry, versions, update queue | team shared with ACLs | metadata in database, workbooks in Blob |
| Members, roles, audit records | team administrative | relational database |

## Required behavior

1. AskAI retrieval filters by the signed-in user and the source ACL before
   ranking or embedding any record.
2. A private answer becomes shared only through an explicit
   `Publish to team knowledge` action, which creates a new team knowledge
   record linked to the private source without exposing the full chat.
3. Shared records use optimistic concurrency through an integer `version`.
   Updates require the version last read by the editor; a mismatch returns
   `409 Conflict`.
4. User-visible deletion sets `deleted_at`, `deleted_by`, and increments
   `version`. Physical purge is a separate administrator retention job.
5. Every shared mutation appends an immutable audit row with actor, timestamp,
   old value, new value, and source references.
6. Team and private vector documents use separate namespaces. Private vectors
   also carry the owner user ID.
7. Price refresh, geocoding, report parsing, and index refresh are background
   jobs. They never depend on an analyst keeping a browser open.
8. Raw chat evidence and normalized research objects are separate records and
   may link to each other; one never overwrites the other.

## Provisioning boundary

Provision from the work computer for company-sensitive production:

- cloud project/account and billing;
- Hong Kong/Singapore production region;
- database, backups, encryption, network allow-list, and service credentials;
- Blob namespace and retention;
- Azure OpenAI gateway and approved server-side secrets;
- execution of the reviewed production migration.

Prepare from either computer:

- schema and migrations;
- API and permission tests;
- UI and client code;
- GitHub Actions;
- sanitized seed exports and import scripts.

The personal computer may provision and administer the Singapore pilot because
the user explicitly limited it to public or sanitized demo data. Supabase
service-role credentials must be stored only in Tencent EdgeOne server
environment variables. If the database is unavailable, shared editors must
fail closed as read-only; they must never silently fall back to browser-local
team storage.

Never commit database passwords, EdgeOne tokens, Azure keys, Clerk secrets, or
raw confidential chats.
