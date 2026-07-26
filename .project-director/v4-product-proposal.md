# Level Grind V4 — Team Research OS Proposal

## Product Decisions

### 1. Storage: one physical corpus, two logical quota pools

- Use one canonical object store, not one bucket per person.
- Give each member a personal quota and the team a shared quota.
- Keep storage quota separate from AI usage quota.
- Store each binary once and track grants separately.
- A shared Analyst file counts against the shared pool, not against every viewer.
- Reading or retrieving a shared file does not duplicate it and does not consume
  the viewer's storage quota. AI retrieval consumes the viewer's AI query/token
  budget and may consume shared indexing capacity.
- Moving a personal file into team context transfers its charge to the shared pool.
- Tiff receives the largest personal quota, configured by an admin rather than hardcoded.
- Deduplicate exact files by content hash; do not duplicate storage when permissions change.

Proposed records:

- `storage_accounts`: member personal quota and current usage.
- `storage_pools`: team shared quota and current usage.
- `file_objects`: one physical object, size, hash, storage provider, and lifecycle state.
- `file_grants`: who can view/manage each object.
- `file_charges`: which personal or shared pool pays for the object.
- `ai_usage_events`: member, provider, model, input/output tokens, estimated
  cost, latency, status, and timestamp. Do not store full prompts by default.

Visibility:

- Every member sees only their own query count, token use, and estimated cost.
- Tiff and developer/operations admins see per-member and team totals.
- Operational access is disclosed in the product privacy/usage notice even
  when the admin dashboard is not visible to ordinary members.
- Product persona and operational permission remain separate; developer
  observability uses an explicit `ops_admin` capability.

### 2. Onboarding: identity first, welcome second

- A user may sign in first and submit an access request without already being
  known by email.
- Admin approves the request and assigns product persona: `pm`, `jem-pm`, or
  `analyst`.
- Security role remains separate: `owner`, `admin`, or `member`.
- Users cannot self-select a privileged persona.
- Known or approved accounts have names prefilled:
  - PM account → `Hi Tiff`
  - JEM PM account → `Hi Lydia`
  - Analyst/other account → ask for preferred display name, then `Hi <name>`
- Show the full-screen welcome once after profile completion; allow replay from settings.
- Persona controls the default home view and prioritization, not access to records by itself.

### 3. Company research corpus: classify before ingesting

Use these source classes:

1. **Annual / interim report** — issuer periodic financial statements and statutory report.
2. **Earnings release / results announcement** — issuer's condensed results for a reporting period.
3. **Earnings call materials** — transcript, prepared remarks, presentation, and Q&A.
4. **Regulatory disclosure** — exchange filings and issuer announcements outside the normal results package.
5. **Sell-side research** — broker-authored analysis, estimates, and recommendations; licensed and permission-restricted.

Preload exchange/issuer public documents where legally allowed. Do not bulk-copy sell-side reports until the firm's license, retention, and user entitlements are confirmed. “All listed companies mentioned in chats” requires an approved chat connector, entity resolution, and a review queue; it cannot be inferred from hidden conversation history.

### 4. Agentic layer: Azure-hosted retrieval gateway

Recommended shape:

```text
Level Grind web
  -> authenticated server request with member + ACL filters
  -> company Azure AI Gateway
  -> Azure AI Search hybrid retrieval
  -> Azure OpenAI embeddings + answer generation
  -> cited answer + document permissions + usage event
```

- Never expose Azure keys in the browser.
- Host the gateway inside company Azure.
- Use Managed Identity and Entra RBAC from the gateway to Azure OpenAI and Azure AI Search.
- Apply document permission filters before retrieval results reach the model.
- Record usage per Level Grind member even if all calls use one company Azure deployment.
- Prefer hybrid retrieval: keyword + vector + metadata filters.
- Return source citations and access-denied states; do not answer from inaccessible documents.

Connectivity options:

- Alpha: a server-side Level Grind route can hold the Azure API key as a secret
  and call a public Azure OpenAI endpoint.
- Network test: a company computer can expose a local gateway through an
  authenticated Dev Tunnel while awake and connected to company networking.
  This is development-only and must not become the production dependency.
- Safer AVD Alpha: an AVD worker keeps an outbound authenticated connection to
  a Level Grind job relay, claims queued requests, calls the internal Azure
  OpenAI endpoint, and posts responses back. This avoids opening an inbound
  route into the company network, but still depends on an always-on AVD.
- Production: deploy the gateway in Azure with a stable authenticated public
  endpoint; keep Azure OpenAI private behind it when required.
- Never reuse an interactive Claude Code/other product OAuth session token as
  a shared backend model credential. Multi-model routing uses supported
  provider APIs or enterprise model platforms.

Recommended provider order while the Azure path is unavailable:

1. DeepSeek V4 Flash as the low-cost default for retrieval-grounded answers.
2. GLM-5.2 as an escalation model for complex Chinese-language synthesis.
3. Kimi K3 as a later quality experiment rather than the Alpha default because
   it is materially more expensive and was newly launched when this decision
   was made.
4. A direct OpenAI or Anthropic API account as the higher-reliability fallback
   when budget permits.

The application uses one provider-neutral server contract. Provider keys remain
server-side, while provider, model, and current token prices are runtime
configuration. This permits later routing without changing the browser client.

Do not use coding-plan quotas for the application. Keep provider policy,
per-user budgets, failover rules, and content-routing disclosure explicit.

## CNINFO Ingestion

The repository now includes a company-list-driven CNINFO fetcher. It:

- accepts six-digit code and company name;
- queries annual and half-year report categories;
- filters exact security code and excludes summaries;
- rate-limits requests;
- validates downloaded PDFs;
- records source URL, announcement ID, date, type, byte size, and SHA-256;
- stores downloaded source files outside Git.

A sample validation downloaded Ping An Bank's full 2025 annual report and full
2025 half-year report.

The first real batch used the 2026-07-26 WeChat listed-company universe:

- 49 current listed companies reviewed;
- 15 Shanghai/Shenzhen A-share companies routed to CNINFO;
- 30 full PDFs downloaded: each company's 2025 annual report and 2025
  half-year report;
- summaries and same-name false matches excluded;
- 78.1 MiB total;
- all file sizes, PDF signatures, and SHA-256 values verified;
- 34 non-A-share companies remain for HKEX, SEC, JPX, TWSE, and KRX adapters.

## Data Boundary Decision

The user confirmed that these research files may be stored outside company
Azure and anywhere/any-device access is the priority. The existing R2 store can
remain the canonical object store for V4.1 and V4.2. The Azure gateway owns
extraction, indexing, retrieval, model calls, and per-user AI usage accounting.

## Delivery Slices

### V4.1 — Onboarding and quota ledger

- Persona and display-name profile.
- One-time welcome experience.
- Personal/shared quota accounting.
- Storage usage shown in member and profile views.

### V4.2 — Research document taxonomy and preload

- Source-type taxonomy and company/entity records.
- Public issuer/exchange ingestion.
- Review queue for chat-mentioned companies.
- License-aware sell-side boundary.

### V4.3 — Azure semantic retrieval

- Company Azure gateway.
- Blob/Search/OpenAI managed-identity path.
- ACL-filtered hybrid retrieval.
- Cited chatbot and per-user usage audit.

## Decisions Required Before Build

1. Confirm whether “JEM PM” is the intended product label.
2. Provide the account mappings for Tiff and Lydia later; this does not block
   access-request onboarding.
3. Confirm whether the company has Azure AI Search in addition to Azure OpenAI.
4. Confirm sell-side report licensing and permitted storage/users.
