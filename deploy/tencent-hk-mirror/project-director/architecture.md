# Architecture — Tencent Cloud Hong Kong mirror

## Existing Context

Level Grind currently runs on OpenAI Sites using a Cloudflare Worker runtime,
D1 (`DB`), R2 (`FILES`), Clerk, DeepSeek, and Tavily. The custom domain still
reaches a `chatgpt.site` origin, which is blocked for the target Mainland users.

## Proposed Shape

```text
Mainland browser
  -> DNS-only cn.level-grind.com
  -> Tencent Cloud Hong Kong public IP
  -> Caddy TLS + streaming reverse proxy
  -> level-grind-workspace.dingjingbo3747.chatgpt.site
     with Host/SNI = level-grind.com
  -> existing Worker + D1 + R2 + AI providers
```

The Hong Kong server stores only Caddy configuration, TLS material, and
container metadata. It does not persist report, event, model, chat, or member
data.

## Proxy Contract

| Area | Contract |
|---|---|
| Browser host | `cn.level-grind.com` |
| Upstream dial host | `level-grind-workspace.dingjingbo3747.chatgpt.site:443` |
| Upstream HTTP Host | `level-grind.com` |
| Upstream TLS SNI | `level-grind.com` |
| Streaming | Caddy `flush_interval -1` |
| Cache | None |
| Health | Local `/mirror-health` response |

## Security / Privacy

- TLS is used on both browser-to-mirror and mirror-to-origin legs.
- The mirror has no application secrets and no database credentials.
- Access logging is not enabled by default to avoid retaining research paths.
- Ports 80 and 443 are public; SSH should be restricted to Jiayi's IP whenever
  practical.
- The Cloudflare DNS record for `cn` must be DNS-only during validation so the
  browser reaches Tencent Hong Kong directly.

## Migration / Compatibility

This phase is reversible. The original apex site remains unchanged. If the
mirror fails, delete or disable only the `cn` DNS record. A future independent
deployment can replace D1/R2/Clerk after this network-path experiment proves
that Mainland users can reach the product.
