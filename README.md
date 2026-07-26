# Level Grind

Level Grind is a private context infrastructure for fundamental research teams. It keeps personal research methods, approved team intelligence, and task-specific context separate while making each layer usable from any device.

## Current capabilities

- Context-aware text, link, and file capture with source, topic, event date, confidence, and personal/team scope.
- Personal context profiles for coverage, output preferences, working method, and private memory.
- Team topic lines and source provenance.
- Persistent team membership with owner, admin, and member roles.
- Task context packs with objective, allowed context, output format, and guardrails.
- Conversation-routing rules and durable handoffs between chats or projects.
- Search across titles, notes, projects, topics, and source systems.
- Markdown download and one-click Obsidian handoff.
- Explicit system-boundary view for Obsidian, company AVD, Excel, and Quant research.
- Responsive desktop and mobile interface.
- PWA installation and offline shell.

## Product boundary

Level Grind is the source of truth for context, provenance, permissions, task state, timelines, and approved research results. Raw data can remain in systems such as Obsidian, Bloomberg, Wind, WeChat, Teams, Excel, or a separate Quant research stack.

The Multi-user Alpha stores team membership in D1. Owners and admins can add or update members, while personal records remain owner-scoped and team records remain shared.

The alpha web app uses Clerk for identity. `LEVEL_GRIND_OWNER_EMAIL` safely bootstraps the first owner; the legacy environment-managed invitation allowlist is retained only as a migration path into persistent membership.

Conversation routing is manual and reviewable in the current release. Automatic topic-shift detection requires a future connector to an approved chat-history source; Level Grind does not silently ingest raw conversations.

GitHub can synchronize validated source, schema, and product documentation between computers. Live D1 records and R2 attachments remain in the cloud deployment and are not committed to Git.

## Development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
npm run build
```

The site declares Cloudflare D1 and R2 bindings in `.openai/hosting.json`.

See `DEPLOYMENT.md` for Clerk, D1, and R2 setup notes.
