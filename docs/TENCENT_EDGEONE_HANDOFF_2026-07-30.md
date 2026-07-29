# Tencent EdgeOne Continuity Deployment

## Why this deployment exists

`level-grind.com` previously pointed to ChatGPT Sites. A Hong Kong mobile
network blocked the `chatgpt.site` upstream before Clerk sign-in, so changing
the invited email or authentication settings could not solve access.

An EdgeOne reverse proxy was also tested and rejected: EdgeOne could receive
the request, but its origin request to `origin.level-grind.com` still reached
ChatGPT Sites and returned HTTP 403.

The continuity deployment therefore serves the demo assets and research data
directly from Tencent EdgeOne Pages/Makers. It does not proxy or redirect to
ChatGPT Sites.

## Current production project

- Tencent project: `level-grind-hk-demo`
- Tencent project ID: `makers-izlj942dw6n9`
- Build command: `npm run edgeone-demo:build`
- Upload artifact (generated, not tracked):
  `deploy/edgeone-demo/level-grind-edgeone-demo.zip`
- Tencent preview:
  `https://level-grind-hk-demo.edgeone.dev`
- Current deployment: `dpow9ya5eggq`
- Deployment preview:
  `https://level-grind-hk-demo-dpow9ya5eggq.edgeone.dev`
- Canonical custom domain: `https://www.level-grind.com`
- Share URL: `https://level-grind.com` (Cloudflare 301 to the canonical domain)

## Included in the continuity build

- Event Research: the committed ten-event research snapshot, security returns,
  price paths, company/industry/quarter filters, source evidence, and
  deterministic cross-event read-through.
- AI Capex: the published `aidc-capex.v1` snapshot, including 75 campuses,
  owner comparisons, capacity/status views, project matrix/detail, and the
  source/freshness ledger.
- Level Grind visual system and responsive navigation.

The build copies the versioned JSON and static assets into the Tencent-hosted
bundle. Browser requests do not depend on a sibling repository or
`chatgpt.site`.

## Deliberate continuity limits

This is a read-only, no-login continuity surface for the immediate PM demo.
Personal/team knowledge, reports, AskAI, Model Workbench, Clerk, D1 writes, R2
uploads, and the live Claim Inbox remain disabled and visibly marked as
`迁移中`. The site does not pretend those flows are available.

The next migration phase should move the authenticated application and its
write APIs to a Tencent-compatible full-stack runtime, then import the existing
D1/R2 export packages. That work is separate from the access-critical
continuity cutover.

## Rebuild and redeploy

1. Run `npm run edgeone-demo:build`.
2. Zip the contents of `deploy/edgeone-demo/dist`, with `index.html` at the ZIP
   root.
3. Open Tencent EdgeOne Makers → `level-grind-hk-demo` → Build & Deploy.
4. Upload the ZIP as a new direct deployment.
5. Confirm Event Research and AI Capex on the generated `edgeone.dev` URL
   before promoting the deployment.

## Domain cutover and rollback

The old Sites origin remains available through `origin.level-grind.com` as a
rollback reference, but it is not suitable for Hong Kong no-VPN access.

For the Tencent cutover:

1. Bind `www.level-grind.com` to the Makers project. Tencent currently
   recommends a subdomain when the DNS zone is hosted by Cloudflare.
2. Point the Cloudflare `www` CNAME to the exact Makers CNAME returned by
   Tencent.
3. Proxy the apex through Cloudflare and deploy two redirect rules:
   HTTP to HTTPS, then `level-grind.com/*` to
   `https://www.level-grind.com/${1}`.
4. Wait for Tencent to show the `www` domain and managed HTTPS certificate as
   effective.
5. Verify the homepage plus:
   - `/data/event-research.json`
   - `/data/aidc-capex/dashboard.json`
6. Confirm from a physical Hong Kong phone with VPN disabled.

At the 2026-07-30 cutover, Tencent reported `www.level-grind.com` as
`Effective` and its free RSA certificate as `Deployed` with automatic renewal.
Fresh browser navigation to `level-grind.com` reached the Tencent-hosted
Research OS without a `chatgpt.site` URL or origin.

Rollback is changing the Cloudflare apex record back to the previous Sites
targets. Doing so restores the old application but also restores the Hong Kong
network block.
