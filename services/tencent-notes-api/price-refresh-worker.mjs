import pg from "pg";

const { Pool } = pg;
const PROVIDER = "Yahoo Finance";
const CALCULATION_VERSION = "claim-window.v2-market-local";
const HORIZONS = [0, 1, 3, 5];
const MAX_YAHOO_CONCURRENCY = 3;

function fail(code, message = code) { return Object.assign(new Error(message), { code }); }
function dateInZone(value, timeZone) { return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function timeInZone(value, timeZone) { return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value)); }
function addDate(date, days) { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }

export function marketConvention(ticker, suppliedZone) {
  if (suppliedZone) return { timeZone: suppliedZone, close: "16:00" };
  const value = String(ticker || "").toUpperCase();
  if (/\.(HK)$/.test(value)) return { timeZone: "Asia/Hong_Kong", close: "16:00" };
  if (/\.(SS|SZ)$/.test(value)) return { timeZone: "Asia/Shanghai", close: "15:00" };
  if (/\.(T)$/.test(value)) return { timeZone: "Asia/Tokyo", close: "15:30" };
  if (/\.(KS|KQ)$/.test(value)) return { timeZone: "Asia/Seoul", close: "15:30" };
  return { timeZone: "America/New_York", close: "16:00" };
}

/** Maps a claim to base/T0 using market-local timestamp and actual observed sessions. */
export function calculateWindow(claimedAt, ticker, observed, suppliedZone) {
  if (!claimedAt) throw fail("CLAIM_TIME_REQUIRED");
  const { timeZone, close } = marketConvention(ticker, suppliedZone); const localDate = dateInZone(claimedAt, timeZone); const localTime = timeInZone(claimedAt, timeZone);
  const t0Candidate = localTime < close ? localDate : addDate(localDate, 1);
  const prices = observed.filter((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(Number(point.close)) && Number(point.close) > 0).sort((a, b) => a.date.localeCompare(b.date));
  const t0Index = prices.findIndex((point) => point.date >= t0Candidate); if (t0Index < 0) return { status: "pending", marketTimezone: timeZone, reason: "T0_NOT_AVAILABLE" };
  const baseIndex = [...prices.keys()].filter((index) => index < t0Index).at(-1); if (baseIndex === undefined) return { status: "pending", marketTimezone: timeZone, reason: "BASE_NOT_AVAILABLE" };
  const base = prices[baseIndex]; const t0 = prices[t0Index]; const returns = Object.fromEntries(HORIZONS.map((horizon) => {
    const point = prices[t0Index + horizon];
    if (!point) return [`t${horizon}`, { date: null, close: null, return: null, status: "pending" }];
    const value = Number(point.close) / Number(base.close) - 1;
    // A close is accepted only when it is strictly positive. Therefore an
    // observed return can never be -100%; keep the extra explicit guard so a
    // malformed provider payload cannot silently become a publishable value.
    const valid = Number.isFinite(value) && value > -1;
    return [`t${horizon}`, { date: point.date, close: Number(point.close), return: valid ? value : null, status: valid ? "observed" : "invalid" }];
  }));
  return { status: returns.t5?.status === "observed" ? "complete" : "partial", marketTimezone: timeZone, baseDate: base.date, baseClose: Number(base.close), t0Date: t0.date, returns };
}

export async function fetchYahooDaily(ticker, { fetchImpl = fetch, retries = 3 } = {}) {
  const symbol = String(ticker || "").trim().toUpperCase(); if (!/^[A-Z0-9.^=-]{1,24}$/i.test(symbol)) throw fail("INVALID_YAHOO_SYMBOL");
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12_000);
      const response = await fetchImpl(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d&includePrePost=false&events=div%2Csplits`, { headers: { Accept: "application/json", "User-Agent": "Level-Grind-Price-Worker/1.0" }, signal: controller.signal }); clearTimeout(timeout);
      if (!response.ok) throw fail(`YAHOO_HTTP_${response.status}`); const body = await response.json(); const result = body.chart?.result?.[0]; if (!result || body.chart?.error) throw fail("YAHOO_EMPTY");
      const timestamps=result.timestamp || []; const quote=result.indicators?.quote?.[0] || {}; const timezone=result.meta?.exchangeTimezoneName || marketConvention(symbol).timeZone;
      const points=timestamps.flatMap((timestamp,index) => { const close=Number(quote.close?.[index]); if (!Number.isFinite(close) || close <= 0) return []; return [{ date: dateInZone(timestamp * 1000, timezone), open: Number(quote.open?.[index]) || null, high: Number(quote.high?.[index]) || null, low: Number(quote.low?.[index]) || null, close, volume: Number(quote.volume?.[index]) || null }]; });
      return { ticker:symbol, currency:result.meta?.currency || null, marketTimezone:timezone, sourceUpdatedAt:new Date().toISOString(), points };
    } catch (error) { lastError=error; if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, attempt * 500)); }
  }
  throw fail(lastError?.code || "YAHOO_UNAVAILABLE");
}

function claimsByTicker(claims) {
  const grouped = new Map();
  for (const claim of claims) {
    const ticker = String(claim.ticker || "").trim().toUpperCase();
    if (!ticker) continue;
    const entries = grouped.get(ticker) || [];
    entries.push(claim);
    grouped.set(ticker, entries);
  }
  return grouped;
}

async function mapWithConcurrency(values, concurrency, worker) {
  const results = new Array(values.length);
  let next = 0;
  const run = async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= values.length) return;
      results[index] = await worker(values[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, run));
  return results;
}

async function recordFailure(pool, runId, claimId, errorCode) {
  await pool.query(
    `INSERT INTO price_refresh_failures (refresh_run_id,claim_id,error_code,attempted_at)
     VALUES ($1,$2,$3,now())
     ON CONFLICT (refresh_run_id,claim_id)
     DO UPDATE SET error_code=EXCLUDED.error_code,attempted_at=now()`,
    [runId, claimId, String(errorCode || "PRICE_REFRESH_FAILED").slice(0, 120)],
  );
}

async function persistTickerRefresh(pool, runId, ticker, claims, yahoo) {
  let refreshed = 0;
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const series = (await db.query(
      `INSERT INTO market_price_series (ticker,provider,market_timezone,currency,adjusted,last_observation_date,updated_at)
       VALUES ($1,$2,$3,$4,false,$5,now())
       ON CONFLICT (ticker,provider,adjusted) DO UPDATE
       SET market_timezone=EXCLUDED.market_timezone,currency=EXCLUDED.currency,last_observation_date=EXCLUDED.last_observation_date,updated_at=now()
       RETURNING id`,
      [yahoo.ticker, PROVIDER, yahoo.marketTimezone, yahoo.currency, yahoo.points.at(-1)?.date || null],
    )).rows[0];
    for (const point of yahoo.points) {
      await db.query(
        `INSERT INTO market_price_points (series_id,trading_date,open,high,low,close,volume)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (series_id,trading_date) DO UPDATE
         SET open=EXCLUDED.open,high=EXCLUDED.high,low=EXCLUDED.low,close=EXCLUDED.close,volume=EXCLUDED.volume`,
        [series.id, point.date, point.open, point.high, point.low, point.close, point.volume],
      );
    }
    for (const claim of claims) {
      const window = calculateWindow(claim.claimed_at, ticker, yahoo.points, claim.market_timezone || yahoo.marketTimezone);
      // Do not overwrite a prior verified window with a partial/pending
      // response. A future hourly run can complete it once sessions arrive.
      if (!window.baseDate) continue;
      const observed = Object.values(window.returns || {}).filter((value) => value?.status === "observed");
      if (observed.some((value) => !Number.isFinite(value.return) || value.return <= -1)) {
        throw fail("INVALID_PRICE_RETURN");
      }
      await db.query(
        `INSERT INTO claim_price_windows (claim_id,series_id,base_date,t0_date,base_close,returns,calculation_version,calculated_at,source_provider,source_updated_at,refresh_run_id)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,now(),$8,$9,$10)
         ON CONFLICT (claim_id,series_id,calculation_version) DO UPDATE
         SET base_date=EXCLUDED.base_date,t0_date=EXCLUDED.t0_date,base_close=EXCLUDED.base_close,returns=EXCLUDED.returns,calculated_at=now(),source_provider=EXCLUDED.source_provider,source_updated_at=EXCLUDED.source_updated_at,refresh_run_id=EXCLUDED.refresh_run_id`,
        [claim.id, series.id, window.baseDate, window.t0Date, window.baseClose, JSON.stringify(window.returns), CALCULATION_VERSION, PROVIDER, yahoo.sourceUpdatedAt, runId],
      );
      refreshed += 1;
    }
    await db.query("COMMIT");
    return { refreshed, failedClaims: [] };
  } catch (error) {
    await db.query("ROLLBACK");
    return { refreshed: 0, failedClaims: claims.map((claim) => ({ claimId: claim.id, errorCode: error.code || "PRICE_REFRESH_FAILED" })) };
  } finally {
    db.release();
  }
}

export async function refreshClaimPrices({ databaseUrl = process.env.DATABASE_URL, fetchImpl, now = new Date().toISOString() } = {}) {
  if (!databaseUrl) throw fail("DATABASE_URL_REQUIRED"); const pool = new Pool({ connectionString: databaseUrl, ssl: process.env.DATABASE_SSL === "false" ? false : undefined }); const client=await pool.connect(); let runId; let lockAcquired = false;
  try {
    // A timer retry must not run alongside an already-active refresh. The lock
    // lives on this dedicated PostgreSQL connection and is released in finally.
    lockAcquired = (await client.query("SELECT pg_try_advisory_lock(481516234) AS acquired")).rows[0]?.acquired === true;
    if (!lockAcquired) return { skipped: true, reason: "PRICE_REFRESH_ALREADY_RUNNING" };
    await client.query("BEGIN"); runId=(await client.query(`INSERT INTO price_refresh_runs (provider,status,started_at) VALUES ($1,'running',now()) RETURNING id`,[PROVIDER])).rows[0].id; const claims=(await client.query(`SELECT id,claimed_at,ticker,market_timezone FROM claims WHERE deleted_at IS NULL AND claimed_at IS NOT NULL AND ticker IS NOT NULL AND ticker <> '' ORDER BY claimed_at DESC`)).rows; await client.query("COMMIT");
    let refreshed = 0;
    let failed = 0;
    const tickerGroups = [...claimsByTicker(claims).entries()];
    const outcomes = await mapWithConcurrency(tickerGroups, MAX_YAHOO_CONCURRENCY, async ([ticker, tickerClaims]) => {
      try {
        const yahoo = await fetchYahooDaily(ticker, { fetchImpl });
        return await persistTickerRefresh(pool, runId, ticker, tickerClaims, yahoo);
      } catch (error) {
        return { refreshed: 0, failedClaims: tickerClaims.map((claim) => ({ claimId: claim.id, errorCode: error.code || "PRICE_REFRESH_FAILED" })) };
      }
    });
    for (const outcome of outcomes) {
      refreshed += outcome.refreshed;
      failed += outcome.failedClaims.length;
      for (const failure of outcome.failedClaims) await recordFailure(pool, runId, failure.claimId, failure.errorCode);
    }
    await pool.query(`UPDATE price_refresh_runs SET status=$2,finished_at=now(),summary=$3::jsonb WHERE id=$1`,[runId,failed ? "partial":"succeeded",JSON.stringify({refreshed,failed,at:now})]); return { runId,refreshed,failed };
  } catch(error) { await client.query("ROLLBACK").catch(()=>{}); if(runId) await pool.query(`UPDATE price_refresh_runs SET status='failed',finished_at=now(),summary=$2::jsonb WHERE id=$1`,[runId,JSON.stringify({error:error.code || "PRICE_REFRESH_FAILED"})]).catch(()=>{}); throw error; } finally { if (lockAcquired) await client.query("SELECT pg_advisory_unlock(481516234)").catch(()=>{}); client.release(); await pool.end(); }
}

if (process.argv[1]?.endsWith("price-refresh-worker.mjs")) refreshClaimPrices().then((result)=>console.log(JSON.stringify(result))).catch((error)=>{ console.error(error.code || "PRICE_REFRESH_FAILED"); process.exitCode=1; });
