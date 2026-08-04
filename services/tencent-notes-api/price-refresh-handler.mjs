import { refreshClaimPrices } from "./price-refresh-worker.mjs";

/**
 * Tencent SCF / CloudBase timer entry point.
 *
 * Deploy this directory as a Node.js function with the handler
 * `price-refresh-handler.main_handler`. DATABASE_URL remains a server-side
 * secret supplied by Tencent; the event deliberately carries no credentials.
 */
export async function main_handler() {
  const result = await refreshClaimPrices();
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
