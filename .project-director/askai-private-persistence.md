# AskAI private history persistence

## Scope

AskAI Projects, Chats and Messages follow one Clerk account across devices while
remaining private to that account. This release does not alter Clerk, shared
Notes/Ideas, invitations or existing member data.

## Contract

- Browser calls `/api/askai-history` only with its Clerk session token.
- EdgeOne derives a SHA-256 object key from the verified Clerk `subject`; it
  never uses an email address as a storage key.
- The stored record redundantly includes the subject and is refused if it does
  not exactly match the authenticated actor.
- A prior `localStorage` snapshot is imported only when no server history
  exists. Once server history exists it wins, avoiding a second device silently
  overwriting it.
- Normal updates use a version counter. A detected conflict stops sync and
  tells the user to reload rather than silently replacing the other device.

## Current boundary

The store is EdgeOne Blob with strong consistency. It is an adequate P0 for
private AskAI history but not the eventual TencentDB source of truth. The Blob
API does not expose a cross-edge compare-and-swap primitive, so simultaneous
writes from two devices can still be detected only best-effort by the version
check. A future TencentDB migration should preserve the Clerk subject and
import this record before changing traffic.
