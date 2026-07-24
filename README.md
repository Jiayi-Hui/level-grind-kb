# Level Grind

Level Grind is an installable private research workspace. Team members capture notes, links, and files once, then find and review them from any device.

## First-release capabilities

- Personal inbox, team, project, and PM views.
- Text, link, and file capture.
- Durable document metadata and attachment storage.
- Search across titles, notes, and projects.
- Markdown download and one-click Obsidian handoff.
- Responsive desktop and mobile interface.
- PWA installation and offline shell.

## Product boundary

The web workspace is the source of truth. Obsidian and Git are optional export or archive destinations, not synchronization engines.

The first production deployment is owner-only. Company-email invitation, team membership, and production role administration are the next rollout phase.

## Development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
npm run build
```

The site declares Cloudflare D1 and R2 bindings in `.openai/hosting.json`.
