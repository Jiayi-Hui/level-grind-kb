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
- A Knowledge base for notes, links, conclusions, and saved evidence, plus a
  Report library for indexed source documents.
- Event-first research timeline with attributed, dated source statements; the
  underlying Claim–Event model remains available without crowding the cards.
- Research Q&A organized by project and conversation, with history contained
  inside the Q&A workspace.
- Markdown download and one-click Obsidian handoff.
- Explicit system-boundary view for Obsidian, company AVD, Excel, and Quant research.
- Responsive desktop and mobile interface.
- PWA installation and offline shell.

## Product boundary

Level Grind is the source of truth for context, provenance, permissions, task state, timelines, and approved research results. Raw data can remain in systems such as Obsidian, Bloomberg, Wind, WeChat, Teams, Excel, or a separate Quant research stack.

The Multi-user Alpha stores team membership in D1. Owners and admins can add or update members, while personal records remain owner-scoped and team records remain shared.

The alpha web app uses Clerk for identity. `LEVEL_GRIND_OWNER_EMAIL` safely bootstraps the first owner; the legacy environment-managed invitation allowlist is retained only as a migration path into persistent membership.

Conversation-routing principles are intentionally outside this product. Level
Grind stores research material, evidence, preferences, and question history; it
does not inspect or route a user's unrelated conversations.

GitHub can synchronize validated source, schema, and product documentation between computers. Live D1 records and R2 attachments remain in the cloud deployment and are not committed to Git.

The tracked Event cold-start seed is sanitized: it includes Event definitions,
Dymon/BBG verification findings, Claim provenance, and Team Notice metadata,
but not raw WeChat messages.

## Development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
npm run build
```

The site declares Cloudflare D1 and R2 bindings in `.openai/hosting.json`.

See `DEPLOYMENT.md` for Clerk, D1, and R2 setup notes.

For a cross-computer continuation, current demo blockers, portable data
boundary, and alternatives to Sites hosting, see
`HANDOVER_WORK_COMPUTER_2026-07-28.md`.
