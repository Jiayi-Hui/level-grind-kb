## Scope

- Feature:
- Release batch:
- Data/API contract affected:
- Private/shared permission impact:

## Checks

- [ ] No secrets, private raw chats, or restricted source data were committed.
- [ ] Portable build works without sibling repositories.
- [ ] Tests and lint pass.
- [ ] Shared mutations preserve version, actor, audit history, and soft delete.
- [ ] Related fixes were tested together as one coherent release candidate.
- [ ] Database migration, seed, rollback, and restore impact were reviewed.
- [ ] `main` receives reviewed work before `production`.

## Release

- [ ] Ready to merge into `main`.
- [ ] Full regression and production build passed on the integrated batch.
- [ ] Separately approved for `production` and automatic deployment.
