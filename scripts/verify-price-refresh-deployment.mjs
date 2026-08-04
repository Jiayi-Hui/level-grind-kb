#!/usr/bin/env node

/**
 * Safe, pre-deployment guard for the TencentDB/Yahoo scheduled worker.
 * It validates variable names and checked-in deployment wiring only. It never
 * opens a database connection, calls Yahoo, or prints a secret value.
 */
import { access, readFile } from "node:fs/promises";

const strict = process.argv.includes("--strict");
const problems = [];
const required = ["DATABASE_URL"];
const missing = required.filter((name) => !String(process.env[name] || "").trim());

if (missing.length) problems.push(`Missing required server variables: ${missing.join(", ")}`);
if (strict && String(process.env.NODE_ENV || "").toLowerCase() !== "production") {
  problems.push("NODE_ENV must be production for a production scheduled refresh.");
}
if (strict && String(process.env.DATABASE_SSL || "").toLowerCase() !== "true") {
  problems.push("DATABASE_SSL must be true for a production TencentDB connection.");
}
if (String(process.env.SUPABASE_URL || "").trim() || String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()) {
  problems.push("Price refresh must target the configured TencentDB shared-research database, not a Supabase fallback.");
}

const requiredFiles = [
  "services/tencent-notes-api/price-refresh-worker.mjs",
  "services/tencent-notes-api/price-refresh-handler.mjs",
  "infra/shared-data/postgres/001_shared_research.sql",
  "infra/shared-data/postgres/002_claim_price_refresh.sql",
];

for (const file of requiredFiles) {
  try { await access(new URL(`../${file}`, import.meta.url)); }
  catch { problems.push(`Required deployment file is missing: ${file}`); }
}

const dockerfile = await readFile(new URL("../services/tencent-notes-api/Dockerfile", import.meta.url), "utf8").catch(() => "");
if (!dockerfile.includes("price-refresh-worker.mjs")) {
  problems.push("Tencent Notes image does not copy price-refresh-worker.mjs.");
}
if (!dockerfile.includes("price-refresh-handler.mjs")) {
  problems.push("Tencent Notes image does not copy price-refresh-handler.mjs.");
}

if (problems.length) {
  for (const problem of problems) console.error(`FAIL: ${problem}`);
  process.exitCode = 1;
} else {
  console.log("PASS: TencentDB/Yahoo price-refresh deployment wiring passes non-secret preflight checks.");
}
