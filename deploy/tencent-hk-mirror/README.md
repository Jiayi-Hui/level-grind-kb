# Tencent Cloud Hong Kong mirror

This package creates a reversible Mainland-accessible mirror for Level Grind.
It proxies requests to the existing Sites deployment, so no D1/R2 data or API
secrets are copied onto the Hong Kong server.

## Server

Use an Ubuntu Tencent Cloud Lighthouse or CVM instance in **Hong Kong** with:

- 2 vCPU / 2 GB RAM or higher
- a stable public IPv4 address
- inbound TCP 80 and 443
- inbound TCP 22 restricted to the operator's IP where practical

## Deploy

Copy this folder to the server, then:

```bash
sudo sh bootstrap-ubuntu.sh
cp env.example .env
```

Edit `.env` and replace `TLS_EMAIL`. Do not change the upstream values unless
the Sites project changes.

Before starting Caddy, create a Cloudflare DNS-only A record:

```text
Type: A
Name: cn
Content: <Tencent Hong Kong public IP>
Proxy status: DNS only
TTL: Auto
```

Then start the mirror:

```bash
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
```

Run the smoke test:

```bash
sh smoke-test.sh https://cn.level-grind.com
```

To test before DNS propagation:

```bash
MIRROR_IP=<public-ip> sh smoke-test.sh https://cn.level-grind.com
```

## Operations

View container state without application data:

```bash
sudo docker compose ps
sudo docker compose logs --tail=100 mirror
```

Update Caddy:

```bash
sudo docker compose pull
sudo docker compose up -d
```

Rollback:

1. Disable or delete only the `cn` DNS record.
2. Run `sudo docker compose down`.

The original `level-grind.com` deployment is not changed by either action.

## Validation boundary

The mirror is not accepted until an invited Mainland user can sign in and
complete a report open, Excel upload/download, and DeepSeek question without a
VPN. The current Clerk key is a development instance; if Clerk's browser API is
unreachable, promote Clerk to production and proxy its Frontend API through the
same domain, or replace it with the team's Microsoft identity provider.
