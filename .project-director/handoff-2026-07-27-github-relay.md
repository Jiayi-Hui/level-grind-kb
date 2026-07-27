# Handoff — GitHub Relay, 2026-07-27

## Purpose

Relay the current Level Grind Research OS implementation from the company
computer to GitHub so work can continue later from another computer.

## Branch and repo

- Repo: `Jiayi-Hui/level-grind-kb`
- Branch: `add-clerk-auth-alpha`
- Local path used for this handoff:
  `C:\Users\hk.msif.rs.intern.3\Downloads\JLGitwork\pm-email\level-grind-kb-latest-clerk`

## What changed in this relay

1. Converted Ask AI toward a chat workspace:
   - project list;
   - chat list under each project;
   - scrollable chat thread;
   - bottom composer;
   - Hybrid as the default evidence mode.

2. Added cloud-persisted chat session data in D1:
   - `research_projects`;
   - `research_chats`;
   - `research_messages`.

   R2 remains the object store for PDFs, attachments, and future large transcript
   archives. Chat metadata/messages live in D1 because they are queried and
   appended frequently.

3. Added `/api/research-sessions` for creating projects and chats.

4. Updated `/api/ask` so each question:
   - creates or reuses a project/chat;
   - stores the user message;
   - retrieves report + web evidence by default in Hybrid mode;
   - stores the assistant message with citations, web results, usage, and cost.

5. Wired Tavily search configuration:
   - preferred secret name: `TAVILY_API_KEY`;
   - fallback supported: `WEB_SEARCH_API_KEY`;
   - `WEB_SEARCH_PROVIDER=tavily`.

6. Added an unauthorized state:
   - a Clerk-authenticated user who is not an active D1 team member sees an
     invitation-required page instead of raw API errors.

7. Updated site metadata to `https://level-grind.com`.

## Verification already run

- `npm run lint` passed.
- `npm test` passed.
- `npm test` includes production build and rendered HTML tests.
- Secret scan of the diff found no committed Tavily key or Clerk/AI secrets.

## Important non-relayed state

GitHub relays source and schema changes only. It does not relay:

- Cloudflare D1 data;
- R2 files;
- Clerk dashboard settings;
- Cloudflare custom domain bindings;
- Cloudflare secrets;
- Tavily/AI provider secrets.

On the next computer, pull this branch and configure hosted secrets separately.

## Next actions from the next computer

1. Pull latest branch:

   ```powershell
   git fetch origin
   git checkout add-clerk-auth-alpha
   git pull --ff-only
   npm install
   npm test
   ```

2. Configure deployment secrets in the hosted environment, not in Git:

   ```text
   WEB_SEARCH_PROVIDER=tavily
   TAVILY_API_KEY=...
   AI_API_KEY=...
   CLERK_SECRET_KEY=...
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
   LEVEL_GRIND_OWNER_EMAIL=...
   ```

3. In Clerk Dashboard, test whether the user's M365 work email can complete
   login. Then set invitation-only or allowed emails before sending the URL to
   colleagues.

4. Rotate the Tavily key if it was exposed in chat or logs. The source tree does
   not include the key.

5. Smoke-test hosted app:
   - owner login;
   - unauthorized login with a non-member account;
   - create project;
   - create chat;
   - ask a Hybrid question;
   - confirm sources show report/web provenance;
   - confirm chat survives refresh.

## Known follow-ups

- The D1 migration file for chat sessions is included, but runtime code also
  creates the tables idempotently. Hosted migration procedure still needs to be
  confirmed for the current Cloudflare Sites flow.
- The older one-shot Q&A history table remains for compatibility. New chat UX
  uses project/chat/message tables.
- No application-layer encryption, quota enforcement, Azure gateway, vector
  search, or filing adapters were added in this relay.
