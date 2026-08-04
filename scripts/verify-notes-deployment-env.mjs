#!/usr/bin/env node

const strict = process.argv.includes("--strict");
const required = [
  "DATABASE_URL",
  "CLERK_SECRET_KEY",
  "LEVEL_GRIND_OWNER_EMAIL",
  "LEVEL_GRIND_INVITED_EMAILS",
  "NOTES_MASTER_KEY_B64",
];
const missing = required.filter((name) => !String(process.env[name] || "").trim());
const problems = [];

if (missing.length) problems.push(`Missing required server variables: ${missing.join(", ")}`);
if (String(process.env.NOTES_INGESTION_ENABLED || "false").toLowerCase() !== "false") {
  problems.push("NOTES_INGESTION_ENABLED must remain false until an explicit production approval.");
}
if (String(process.env.SUPABASE_URL || "").trim() || String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()) {
  problems.push("Notes service must not be configured with Supabase fallback variables.");
}
if (String(process.env.KMS_PROVIDER || "").trim() || String(process.env.TENCENT_KMS_KEY_ID || "").trim()) {
  problems.push("This P0 uses application AES-256-GCM and must not require a KMS runtime dependency.");
}
const encryptionKey = String(process.env.NOTES_MASTER_KEY_B64 || "").trim();
const keyRing = String(process.env.NOTES_MASTER_KEYS_JSON || "").trim();
const activeKeyVersion = String(process.env.NOTES_ACTIVE_KEY_VERSION || "1").trim();

function isExactAesKey(value) {
  const decoded = Buffer.from(value, "base64");
  return decoded.length === 32 && decoded.toString("base64") === value.replace(/\s/g, "");
}

if (encryptionKey && !isExactAesKey(encryptionKey)) {
  problems.push("NOTES_MASTER_KEY_B64 must be canonical base64 and decode to exactly 32 bytes for AES-256.");
}
if (keyRing) {
  try {
    const parsed = JSON.parse(keyRing);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object" || !Object.keys(parsed).length) {
      problems.push("NOTES_MASTER_KEYS_JSON must be a non-empty JSON object keyed by positive integer version.");
    } else {
      for (const [version, key] of Object.entries(parsed)) {
        if (!/^[1-9]\d*$/.test(version) || typeof key !== "string" || !isExactAesKey(key)) {
          problems.push("NOTES_MASTER_KEYS_JSON must contain only positive-integer versions and canonical 32-byte base64 AES keys.");
          break;
        }
      }
      if (!Object.hasOwn(parsed, activeKeyVersion)) {
        problems.push("NOTES_ACTIVE_KEY_VERSION must name a key present in NOTES_MASTER_KEYS_JSON.");
      }
    }
  } catch {
    problems.push("NOTES_MASTER_KEYS_JSON is not valid JSON.");
  }
}
if (!/^[1-9]\d*$/.test(activeKeyVersion)) problems.push("NOTES_ACTIVE_KEY_VERSION must be a positive integer.");
if (strict && String(process.env.NODE_ENV || "").toLowerCase() !== "production") {
  problems.push("NODE_ENV must be production for a production deployment.");
}
if (strict && String(process.env.DATABASE_SSL || "").toLowerCase() !== "true") {
  problems.push("DATABASE_SSL must be true for a production deployment.");
}
if (strict && String(process.env.NOTES_PARSER_LOCAL_DEV_BYPASS || "false").toLowerCase() === "true") {
  problems.push("NOTES_PARSER_LOCAL_DEV_BYPASS must be false in production.");
}
if (strict && !String(process.env.CLERK_AUTHORIZED_PARTIES || "").trim()) {
  problems.push("CLERK_AUTHORIZED_PARTIES must list the production Level Grind origins.");
}

if (problems.length) {
  for (const problem of problems) console.error(`FAIL: ${problem}`);
  process.exitCode = strict ? 1 : 0;
} else {
  console.log("PASS: Notes deployment environment passes the non-secret P0 checks.");
}
