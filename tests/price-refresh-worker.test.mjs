import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateWindow, fetchYahooDaily, marketConvention } from "../services/tencent-notes-api/price-refresh-worker.mjs";
import { authorizePriceRefreshTrigger, main_handler } from "../services/tencent-notes-api/price-refresh-handler.mjs";

const prices = [
  { date: "2026-07-01", close: 100 }, { date: "2026-07-02", close: 102 },
  { date: "2026-07-03", close: 101 }, { date: "2026-07-06", close: 103 },
  { date: "2026-07-07", close: 104 }, { date: "2026-07-08", close: 105 }, { date: "2026-07-09", close: 106 },
];

test("maps pre-close and post-close claims to actual sessions and never invents -100%", () => {
  const pre = calculateWindow("2026-07-02T06:00:00Z", "0700.HK", prices, "Asia/Hong_Kong");
  assert.equal(pre.baseDate, "2026-07-01"); assert.equal(pre.t0Date, "2026-07-02"); assert.ok(Math.abs(pre.returns.t0.return - 0.02) < 1e-12);
  const post = calculateWindow("2026-07-02T10:00:00Z", "0700.HK", prices, "Asia/Hong_Kong");
  assert.equal(post.baseDate, "2026-07-02"); assert.equal(post.t0Date, "2026-07-03"); assert.equal(post.returns.t3.date, "2026-07-08"); assert.equal(post.returns.t5.status, "pending");
  assert.ok(Object.values(post.returns).every((value) => value.return === null || value.return > -1));
});

test("uses exchange-local daily dates returned by Yahoo and ignores zero prices", async () => {
  const body = { chart: { result: [{ timestamp: [1782921600, 1783008000], meta: { exchangeTimezoneName: "Asia/Hong_Kong", currency: "HKD" }, indicators: { quote: [{ close: [10, 0], open: [9, 0], high: [11, 0], low: [8, 0], volume: [100, 0] }] } }] } };
  const series = await fetchYahooDaily("0700.HK", { retries: 1, fetchImpl: async () => new Response(JSON.stringify(body), { status: 200 }) });
  assert.equal(series.points.length, 1); assert.equal(series.marketTimezone, "Asia/Hong_Kong"); assert.equal(marketConvention("0700.HK").timeZone, "Asia/Hong_Kong");
});

test("worker is portable, serialised, idempotent and records refresh lineage", async () => {
  const [worker, migration, deployment] = await Promise.all([readFile(new URL("../services/tencent-notes-api/price-refresh-worker.mjs", import.meta.url), "utf8"), readFile(new URL("../infra/shared-data/postgres/002_claim_price_refresh.sql", import.meta.url), "utf8"), readFile(new URL("../services/tencent-notes-api/PRICE_REFRESH_DEPLOYMENT.md", import.meta.url), "utf8")]);
  assert.match(worker, /pg_try_advisory_lock/); assert.match(worker, /ON CONFLICT \(series_id,trading_date\)/); assert.match(worker, /ON CONFLICT \(claim_id,series_id,calculation_version\)/); assert.match(worker, /price_refresh_failures/); assert.match(worker, /retries = 3/); assert.match(worker, /claimsByTicker/); assert.match(worker, /mapWithConcurrency/); assert.match(worker, /value > -1/); assert.match(migration, /price_refresh_runs/); assert.match(migration, /source_updated_at/); assert.match(deployment, /hourly execution/i); assert.match(deployment, /PRICE_REFRESH_TRIGGER_TOKEN/);
});

test("timer handler is disabled by default and requires its server-side trigger token", async () => {
  const env = { PRICE_REFRESH_ENABLED: "true", PRICE_REFRESH_TRIGGER_TOKEN: "timer-secret", DATABASE_URL: "postgresql://example" };
  assert.doesNotThrow(() => authorizePriceRefreshTrigger({ priceRefreshToken: "timer-secret" }, env));
  assert.throws(() => authorizePriceRefreshTrigger({}, env), { message: "PRICE_REFRESH_TRIGGER_UNAUTHORIZED" });
  assert.throws(() => authorizePriceRefreshTrigger({ priceRefreshToken: "timer-secret" }, { ...env, PRICE_REFRESH_ENABLED: "false" }), { message: "PRICE_REFRESH_DISABLED" });
  const result = await main_handler({ priceRefreshToken: "timer-secret" }, {}, { env, refresh: async ({ databaseUrl }) => ({ databaseUrl, refreshed: 1, failed: 0 }) });
  assert.equal(result.refreshed, 1);
});
