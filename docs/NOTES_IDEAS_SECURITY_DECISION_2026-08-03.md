# Notes / Ideas security decision — 2026-08-03

## Decision status

This is an interim product and governance decision, not approval to ingest
confidential team research.

- Continue building the Notes and Idea Book product, schemas, permissions,
  encryption boundary, audit trail, upload UX, parsing states and tests.
- Do not upload, migrate, seed or invite team members to upload real Notes or
  Ideas until Tiff confirms the permitted data classes, hosting boundary and AI
  processing policy.
- Development and QA use public, synthetic or properly de-identified fixtures
  only. Synthetic fixtures must be visibly labelled and must never be presented
  as real investment research.
- Existing Event Research and AI Capex production behavior is outside this
  temporary ingestion freeze unless a separate security review changes it.

## Stakeholder signal

Tiff acknowledged the two principal third-party boundaries: cloud
infrastructure and external model providers. His current signal is:

- he needs more time to define the acceptable security boundary;
- he tentatively prefers not to place the long-term database on the company's
  existing internal server path;
- this is not yet approval for Tencent Cloud, a personal cloud account, or an
  external model provider;
- until the boundary is agreed, team Notes / Ideas remain consolidated through
  Tiff and Jiayi rather than uploaded by analysts to a shared production store.

No final infrastructure decision should be inferred from this signal.

## Current likely operator model

Jiayi is currently the only person with enough time and operating capacity to
build and maintain the system. The near-term cloud resources may therefore
remain under Jiayi's account. Treat this as an operational constraint, not the
desired permanent ownership model.

If a personal account is used, production approval additionally requires:

- a written asset and data ownership statement;
- a second authorized recovery contact or break-glass procedure;
- MFA and least-privilege service identities;
- billing/export visibility and a documented handover path;
- backup restoration evidence and key-recovery documentation;
- no dependency on Jiayi's personal device being online for availability.

## Risk register and controls

| Boundary | Risk | Required control | Residual decision |
|---|---|---|---|
| Cloud provider | Provider infrastructure and account administrators are outside Dymon; account compromise may expose decryptable data | HTTPS; private database/COS networking; application AES-256-GCM encryption; least privilege; MFA; audit logs; backup and key rotation | Tiff must approve which data classes may be hosted externally |
| Personal cloud account | Bus-factor, ownership, billing and recovery depend on Jiayi | Recovery/handover runbook; second recovery path; company/team ownership transition plan; immutable exports | Interim only unless explicitly approved |
| External model API | Model processing requires readable context; prompts, retrieved passages or logs may expose research | Default deny by sensitivity; redact identities/sources/sensitive numbers; provider retention/no-training review; per-request audit; explicit AI permission | Ideas: external AI disabled for first release. Notes: only approved and de-identified content may be eligible |
| Search/indexing | Removing names or numbers alone may not remove thesis, source or position sensitivity | Four-level classification; metadata/body separation; server-side permission-aware indexes; private and shared indexes separated | Restricted content is excluded from external reranking/synthesis |
| Team access | A valid login does not imply permission to every item | Team ACLs, role checks, download controls, soft delete, optimistic concurrency, mutation/view audit | Tiff and Jiayi define role matrix before real ingestion |
| Raw files | PDF/DOCX/XLSX may contain hidden metadata, authors, links, comments and non-public context | Private object storage, file scanning, immutable original, extraction copy, metadata review and access audit | No real source files during the freeze |

## Data handling baseline

- `public`: public company/ticker/market data and public sources; may be indexed
  in plaintext.
- `internal`: minimal operational metadata; authenticated team access only.
- `confidential`: Notes, internal estimates, thesis and validation work;
  application AES-256-GCM encrypted, external AI off unless explicitly
  approved after de-identification.
- `restricted`: positions, sizing, AUM, long/short direction, non-public meeting
  content and source identity; application AES-256-GCM encrypted, narrow
  PM/owner access, no external AI by default.

Entity/number redaction is not sufficient by itself: a thesis, catalyst,
position direction or identifiable source can remain sensitive without names
or numbers.

## Release gates for real Notes / Ideas

Real-data ingestion remains blocked until all are true:

1. Tiff confirms permitted data classes and the cloud/AI boundary in writing.
2. The production account, ownership, recovery and handover model is recorded.
3. Private database/COS, application encryption key custody/rotation,
   least-privilege identities and audit retention are configured and tested.
4. Existing Clerk identities, invitations, roles and member-created data remain
   intact; no re-invites are required.
5. Two authorized accounts pass cross-user create/read/edit and denied-access
   tests; backup restore and rollback are verified.
6. Ideas external AI is disabled. Notes AI requires an explicit per-record
   policy and the approved de-identification/provider policy.
7. Production upload UI clearly communicates sensitivity and rejects uploads
   while the ingestion freeze is active.
