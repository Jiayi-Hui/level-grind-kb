import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const trackedPath = resolve(projectRoot, "data", "events", "claim-ledger-dashboard.json");
const publicPath = resolve(projectRoot, "public", "data", "claim-ledger-dashboard.json");
const payload = JSON.parse(await readFile(trackedPath, "utf8"));

if (payload.schemaVersion !== "claim-ledger.v1") {
  throw new Error(`Unsupported Claim ledger schema: ${payload.schemaVersion || "missing"}.`);
}
if (payload.recordCounts?.claims !== payload.claims?.length) {
  throw new Error("Claim ledger count does not match the tracked Claim records.");
}
if (!payload.claims.every((claim) => claim.claimId && claim.originalClaim)) {
  throw new Error("Claim ledger contains a record without an ID or Claim text.");
}

await mkdir(dirname(publicPath), { recursive: true });
await copyFile(trackedPath, publicPath);
console.log(
  `Published portable Claim ledger: ${payload.claims.length} Claims, `
  + `${payload.recordCounts.claimSecurityMappings} mappings, cutoff ${payload.dataCutoff}.`,
);
