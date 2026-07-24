# Architecture

## Proposed Shape

- Vinext PWA for the workspace interface.
- Cloudflare D1 for documents and searchable metadata.
- Cloudflare R2 for uploaded file bytes.
- Server routes enforce identity and own all database/storage access.
- Sites access control protects the owner-only preview.

## Data Model

`documents`: id, title, kind, body, source URL, author identity, project, importance, visibility, attachment metadata, timestamps.

## API Contract

| Route | Method | Purpose |
|---|---|---|
| `/api/documents` | GET | Search and list accessible documents |
| `/api/documents` | POST | Create text, link, or file material |
| `/api/files/:id` | GET | Download an authorized attachment |

## Security / Privacy

- Browser code never receives database or storage credentials.
- Production requests require a forwarded authenticated identity.
- File downloads are served after the same authorization boundary.
- The first release is owner-only until external company-email auth is configured.

