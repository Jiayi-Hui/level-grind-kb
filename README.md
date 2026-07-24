# Level Grind

Level Grind is a private context infrastructure for fundamental research teams. It keeps personal research methods, approved team intelligence, and task-specific context separate while making each layer usable from any device.

## Current capabilities

- Context-aware text, link, and file capture with source, topic, event date, confidence, and personal/team scope.
- Personal context profiles for coverage, output preferences, working method, and private memory.
- Team topic lines and source provenance.
- Task context packs with objective, allowed context, output format, and guardrails.
- Search across titles, notes, projects, topics, and source systems.
- Markdown download and one-click Obsidian handoff.
- Explicit system-boundary view for Obsidian, company AVD, Excel, and Quant research.
- Responsive desktop and mobile interface.
- PWA installation and offline shell.

## Product boundary

Level Grind is the source of truth for context, provenance, permissions, task state, timelines, and approved research results. Raw data can remain in systems such as Obsidian, Bloomberg, Wind, WeChat, Teams, Excel, or a separate Quant research stack.

The current production deployment remains owner-only. Company-email invitation, team membership, record-level roles, automated extraction, external connectors, agent execution, and two-way Obsidian sync are later phases.

The alpha web app uses Clerk for simple email-based login plus an environment-managed invitation allowlist. Outlook, Teams, and other company systems remain future connector channels, not the primary login dependency.

## Development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
npm run build
```

The site declares Cloudflare D1 and R2 bindings in `.openai/hosting.json`.

See `DEPLOYMENT.md` for Clerk, D1, and R2 setup notes.
