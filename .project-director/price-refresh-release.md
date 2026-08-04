# Hourly price refresh — release acceptance

## Scope

Refresh shared Claim price windows from Yahoo Finance hourly on Tencent, with
no browser dependency and no change to Clerk or member authentication.

## Acceptance

- One Tencent timer-only handler is authenticated by a server-side trigger
  token and disabled unless explicitly enabled.
- Concurrent runs are skipped with a PostgreSQL advisory lock.
- One Yahoo request is made per ticker, not per Claim; writes are upserts and
  each ticker is transactional.
- Invalid/zero/non-finite prices never create or overwrite a -100% return.
- Per-run and per-claim failures are written to the existing refresh tables.
- The release documentation names deployment variables, trigger payload,
  hourly schedule, manual smoke test and rollback.

## Non-goals

- Intraday bars and real-time tick data. Yahoo's daily endpoint is refreshed
  hourly so completed T+ windows appear promptly after each market publishes a
  daily session; it is not a replacement for Bloomberg intraday data.
