# Tencent hourly Yahoo Finance price refresh

This is a Tencent server-side background job for the shared-research
PostgreSQL schema. It is **not** an EdgeOne function, browser timer, or
GitHub Action. It continues when no analyst has Level Grind open.

## Release contract

- Run in Hong Kong through a Tencent CloudBase/SCF timer against the same
  private TencentDB used by the shared research service.
- Do not expose an HTTP trigger. Give the timer invocation role permission to
  invoke only this function.
- Enable the runtime variables below as Tencent secrets, never as browser,
  EdgeOne, GitHub, or timer-log variables:

  - `DATABASE_URL`
  - `DATABASE_SSL=true`
  - `NODE_ENV=production`
  - `PRICE_REFRESH_ENABLED=true`
  - `PRICE_REFRESH_TRIGGER_TOKEN` (a long random value)

- Configure the timer for hourly execution. Its fixed JSON payload must be:

  ```json
  { "priceRefreshToken": "<same value held in PRICE_REFRESH_TRIGGER_TOKEN>" }
  ```

  Do not use an HTTP URL or an analyst browser to invoke the refresh. The
  function rejects missing or incorrect tokens before opening the database.

## Deployment order

1. Apply `infra/shared-data/postgres/001_shared_research.sql` and then
   `infra/shared-data/postgres/002_claim_price_refresh.sql` to the target
   TencentDB. The Notes-only migrations do not create the claims/price tables.
2. Run the non-secret preflight in the target runtime. It verifies only that
   required values are present:

   ```sh
   npm run price-refresh:preflight
   ```

3. Deploy the same image with handler
   `price-refresh-handler.main_handler`. Attach one private Tencent timer with
   the payload above; do not add public HTTP invocation.
4. Manually invoke the timer once from Tencent with the same payload and check
   `price_refresh_runs` and `price_refresh_failures`. Only safe counts and run
   IDs are written to function logs.
5. Enable the hourly cron only after the manual invocation completes.

## Safety behavior

- PostgreSQL advisory locking makes overlapping hourly attempts return
  `PRICE_REFRESH_ALREADY_RUNNING` without duplicating writes.
- The worker fetches Yahoo once per unique ticker, with bounded concurrency,
  then upserts prices and claim windows transactionally.
- Zero, negative, non-finite and mathematically -100% returns are rejected.
  A bad Yahoo response rolls back that ticker's writes and records a failure
  per affected claim; it never overwrites a prior good window with `-100%`.
- Incomplete future T+ windows remain pending. They are retried by later hourly
  runs rather than invented.
- Rollback is simply disabling the timer or setting
  `PRICE_REFRESH_ENABLED=false`; existing validated price windows remain.
