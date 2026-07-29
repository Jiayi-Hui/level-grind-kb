import { readFile } from "node:fs/promises";

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error("Usage: node scripts/publish-claim-inbox.mjs /absolute/path/claim.json");
}

const endpoint = process.env.LEVEL_GRIND_CLAIM_INBOX_URL;
const secret = process.env.CLAIM_INGEST_SECRET;
if (!endpoint || !secret) {
  throw new Error("Set LEVEL_GRIND_CLAIM_INBOX_URL and CLAIM_INGEST_SECRET in the local bridge environment.");
}

const payload = JSON.parse(await readFile(inputPath, "utf8"));
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Claim-Ingest-Secret": secret,
  },
  body: JSON.stringify(payload),
});
const result = await response.json();
if (!response.ok) {
  throw new Error(result.error || `Claim intake failed with ${response.status}.`);
}

console.log(JSON.stringify(result, null, 2));
