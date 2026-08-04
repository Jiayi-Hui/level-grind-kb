# Research input release — 2026-08-04

## Scope

- Keep the current Clerk instance, user identities, invitations, and sessions unchanged.
- Restore a permanently visible AskAI composer on desktop and mobile layouts.
- Add the reviewed OpenRouter model catalogue behind a server-side allowlist.
- Rename the product entries to Notes库 and Ideas库.
- Map Notes and Ideas fields to the two PM-approved DOCX templates.
- Persist four data classifications and six explicit handling permissions.
- Refresh Yahoo Finance paths at an hourly production cache boundary, with a portable SCF timer worker prepared for later activation.

## Acceptance evidence

- `npm run lint`
- `npm run edgeone-demo:build`
- `node --test tests/*.test.mjs` (46 passing)
- Desktop browser inspection at 1280×720: AskAI composer, textarea, model picker, thinking control, and send button are visible without page scrolling.
- Browser contract inspection: Notes and Ideas expose all template fields, Public/Internal/Confidential/Restricted, team view, download, internal AI, external AI, web search, and redaction controls.

## Production boundaries

- OpenRouter credentials remain server-side. The browser can select only model IDs returned by the authenticated server capability response. Event DB and AI Capex evidence may be sent after an explicit OpenRouter model selection; Notes/Ideas remain excluded until their record-level external-AI and redaction policies are enforced by retrieval.
- Notes/Ideas retain prior records; new template and policy fields use backward-compatible defaults.
- The current production price path is revalidated at most once per hour through the EdgeOne cache, and an open Event page requests a refresh hourly. The included SCF timer worker is not active until its database migration, environment variables, and timer trigger are deployed.
- The live proxy uses Yahoo Chart first and Yahoo Spark as a same-provider fallback when shared cloud egress is rate-limited; it never converts missing or zero values into returns.
- Clerk configuration and keys are intentionally untouched.
