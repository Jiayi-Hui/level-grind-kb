# PRD

## Objective

Create the first usable version of Level Grind: a private, installable team research workspace where members capture material once and read it from any device.

## Users

- Contributor: creates and manages their own material.
- Analyst: also reads authorized team and project material.
- PM: reviews the whole team and curates topics.
- Admin: manages access and system settings separately from research authority.

## Scope

- Responsive PWA workspace.
- Inbox, team, projects, PM and search views.
- Text/link/file capture with durable storage.
- Search and filtering.
- Markdown download, copy, and Obsidian handoff.
- Private initial deployment for owner testing.

## Non-Goals

- Two-way Obsidian sync.
- Production corporate email authentication.
- Automatic OCR and AI summarization.
- GitHub repository mirroring.

## Acceptance Criteria

- A saved item remains available after refresh and from another signed-in browser.
- Users can upload text, links, and attachments.
- The interface works on desktop and mobile.
- A note can be downloaded as Markdown or sent to Obsidian.
- The initial deployment is private.

## Risks

- External company-email login needs a production identity service before team rollout.
- Full-text extraction from binary attachments is deferred.

