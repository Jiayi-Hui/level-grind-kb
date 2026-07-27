# PRD — Mainland-accessible Hong Kong mirror

## Objective

Make Level Grind reachable from Mainland China without requiring a VPN while
preserving the current OpenAI Sites deployment, D1/R2 data, and application
behavior.

## Users

- Dymon research-team members working from Mainland China.
- Jiayi as the workspace owner and release operator.

## Scope

- Add a reversible Hong Kong reverse-proxy deployment for
  `cn.level-grind.com`.
- Preserve streaming research answers, uploads, downloads, cookies, and normal
  API behavior.
- Keep `level-grind.com` on the current deployment until Mainland validation
  succeeds.
- Provide an operational smoke test and rollback path.

## Non-Goals

- Migrating D1, R2, or AI providers in this phase.
- Copying research data onto the mirror server.
- Switching the apex domain before user acceptance testing.
- Claiming Mainland reliability before testing China Mobile, Unicom, and
  Telecom paths.

## Assumptions

- The mirror runs on a Tencent Cloud Hong Kong Ubuntu instance with a public IP.
- `cn.level-grind.com` is initially configured as DNS-only, not Cloudflare
  proxied.
- The existing Sites URL remains the source of truth.

## Requirements

- FR-1: TLS terminates on the Hong Kong mirror with an automatically renewed
  certificate.
- FR-2: The mirror forwards requests to the existing Level Grind source while
  preserving the production host contract.
- FR-3: Streaming responses and WebSocket upgrades are not buffered.
- FR-4: Private responses are not cached on the mirror.
- FR-5: A mirror-local health endpoint remains available when the source is
  unhealthy.
- FR-6: Deployment and rollback require no application-data migration.

## Acceptance Criteria

- AC-1: `https://cn.level-grind.com/mirror-health` returns `200`.
- AC-2: The signed-out workspace page and sign-in route return `200`.
- AC-3: Static JS/CSS assets load through the mirror.
- AC-4: An unauthenticated protected API returns the same `401` contract through
  the mirror instead of a proxy error.
- AC-5: A Mainland user can sign in with an invited account.
- AC-6: A Mainland user can open a report, upload/download the simple Excel
  demo, and complete one DeepSeek research question.
- AC-7: Disabling the `cn` DNS record leaves the original site unaffected.

## Risks

- The current Clerk key is a development instance whose browser API may itself
  be unreliable from Mainland China. This must be tested after the page mirror
  works.
- The mirror still depends on the existing Sites origin; it improves the user
  network path but is not yet an independent disaster-recovery deployment.
- Mainland cross-border performance varies by carrier. Hong Kong hosting is a
  pragmatic first step, not an ICP-backed Mainland SLA.
