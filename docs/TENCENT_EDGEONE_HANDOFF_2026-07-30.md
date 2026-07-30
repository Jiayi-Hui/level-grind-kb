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
- Current deployment: `dpy72u46jgy1`
- Deployment preview:
  `https://level-grind-hk-demo-dpy72u46jgy1.edgeone.dev`
- Canonical custom domain: `https://www.level-grind.com`
- Share URL: `https://level-grind.com` (Cloudflare 301 to the canonical domain)

## Included in the continuity build

- Event DB: 45 real group-chat Claims, 25 original timestamps, 88
  Claim–security mappings, 48 public price series, BBG-derived event windows,
  available Dymon/BBG findings, source filtering, and cross-Claim comparison.
- AI Capex: the published `aidc-capex.v1` snapshot, including 75 campuses,
  owner comparisons, capacity/status views, project matrix/detail, and the
  source/freshness ledger.
- Clerk: the existing invited-account client and session gate. The production
  sign-in modal supports the configured Google, Microsoft, GitHub, and
  email/password methods.
- Level Grind visual system and responsive navigation.
- Agentic research panels embedded in Event DB and AI Capex, with device-local
  Projects/Chats, Personal Knowledge saves, Markdown download, and Obsidian
  export.
- Event DB semantic search runs locally in the browser with the MIT-licensed
  `BAAI/bge-small-zh-v1.5` model, using the browser-compatible
  `Xenova/bge-small-zh-v1.5` ONNX conversion. It ranks Claims with a hybrid of
  vector similarity and literal matches, so concepts such as `国产算力` can
  retrieve 910/950, domestic AI-chip, supercomputing, and other semantically
  related records even when the exact phrase is absent.
- Authenticated Tencent `/api/agent-chat` function. Tavily and the non-secret
  DeepSeek runtime settings are configured in Tencent.

The build copies the versioned JSON and static assets into the Tencent-hosted
bundle. Browser requests do not depend on a sibling repository or
`chatgpt.site`.

The semantic model and ONNX WebAssembly runtime are also part of the static
bundle under `/models/bge-small-zh-v1.5/` and `/transformers-wasm/`. The first
semantic search downloads roughly 45 MB and builds the 45-Claim vector index;
the browser then caches the files and keeps the vectors in memory for the
session. Claim text and search queries are not sent to Hugging Face or another
embedding API.

## Deliberate continuity limits

The continuity surface is gated by Clerk. Event and AI Capex agentic research,
device-local Projects/Chats, and device-local Personal Knowledge are enabled.
Reports, unified AskAI, Model Workbench, shared multi-user persistence, D1
writes, R2 uploads, and the live Claim Inbox remain disabled and visibly
marked as `待上线`.

DeepSeek and Tavily credentials are stored only in Tencent Environment
Variables and are masked in the console. The previous Sites secret was not
read or copied. A final signed-in browser prompt remains the production
end-to-end check; unauthenticated calls correctly stop at Clerk.

Clerk currently protects the rendered UI, not the static JSON URLs. Do not
place confidential research in this bundle until the data routes run behind a
Tencent server-side authorization check.

The next migration phase should move the authenticated application and its
write APIs to a Tencent-compatible full-stack runtime, then import the existing
D1/R2 export packages. That work is separate from the access-critical
continuity cutover.

## Rebuild and redeploy

1. Run `npm run edgeone-demo:build`.
2. Zip the contents of `deploy/edgeone-demo/dist`, with `index.html` at the ZIP
   root.
3. Deploy with the official EdgeOne CLI:
   `edgeone makers deploy deploy/edgeone-demo/dist -n level-grind-hk-demo -e production`.
   Use a short-lived Makers API Token when interactive international-account
   login returns `UnsupportedRegion`.
4. Alternatively, open Tencent EdgeOne Makers → `level-grind-hk-demo` →
   Build & Deploy and upload the ZIP as a new direct deployment.
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
   - `/data/claim-ledger-dashboard.json`
   - `/data/aidc-capex/dashboard.json`
6. Confirm from a physical Hong Kong phone with VPN disabled.

At the 2026-07-30 cutover, Tencent reported `www.level-grind.com` as
`Effective` and its free RSA certificate as `Deployed` with automatic renewal.
Fresh browser navigation to `level-grind.com` reached the Tencent-hosted
Research OS without a `chatgpt.site` URL or origin.

Rollback is changing the Cloudflare apex record back to the previous Sites
targets. Doing so restores the old application but also restores the Hong Kong
network block.
