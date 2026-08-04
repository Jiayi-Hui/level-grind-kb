import { refreshClaimPrices } from "./price-refresh-worker.mjs";
import crypto from "node:crypto";

/**
 * Tencent SCF / CloudBase timer entry point.
 *
 * Deploy this directory as a Node.js function with the handler
 * `price-refresh-handler.main_handler`. DATABASE_URL remains a server-side
 * secret supplied by Tencent. This function must be attached only to a Tencent
 * timer trigger (never a public HTTP trigger). The timer sends a small signed
 * control payload so an accidental/manual function invocation cannot refresh
 * the shared price store.
 */
export function authorizePriceRefreshTrigger(event = {}, env = process.env) {
  if (env.PRICE_REFRESH_ENABLED !== "true") {
    const error = new Error("PRICE_REFRESH_DISABLED");
    error.code = "PRICE_REFRESH_DISABLED";
    throw error;
  }
  const expected = String(env.PRICE_REFRESH_TRIGGER_TOKEN || "");
  const supplied = String(event?.priceRefreshToken || "");
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  const matches = expectedBuffer.length === suppliedBuffer.length
    && expectedBuffer.length > 0
    && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
  if (!matches) {
    const error = new Error("PRICE_REFRESH_TRIGGER_UNAUTHORIZED");
    error.code = "PRICE_REFRESH_TRIGGER_UNAUTHORIZED";
    throw error;
  }
}

export async function main_handler(event = {}, _context = {}, { refresh = refreshClaimPrices, env = process.env } = {}) {
  void _context;
  authorizePriceRefreshTrigger(event, env);
  const result = await refresh({ databaseUrl: env.DATABASE_URL });
  // Safe operational metadata only: no database URL, claims, or price values.
  console.log(JSON.stringify({
    job: "claim-price-refresh",
    status: "completed",
    refreshed: result.refreshed,
    failed: result.failed,
    skipped: Boolean(result.skipped),
    reason: result.reason || null,
    runId: result.runId || null,
  }));
  return result;
}
