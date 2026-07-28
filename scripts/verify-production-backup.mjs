import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const root = path.resolve(process.argv[2] || "");
if (!process.argv[2]) {
  throw new Error("Usage: node scripts/verify-production-backup.mjs <backup-directory>");
}

const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
if (manifest.format !== "level-grind-production-backup") {
  throw new Error("Unsupported backup format.");
}

const entries = [
  ...manifest.d1.tables.map((table) => ({
    path: table.path,
    bytes: table.bytes,
    sha256: table.sha256,
  })),
  ...manifest.r2.objects.map((object) => ({
    path: object.path,
    bytes: object.size,
    sha256: object.sha256,
  })),
];

for (const entry of entries) {
  const bytes = await readFile(path.join(root, entry.path));
  if (bytes.length !== entry.bytes) {
    throw new Error(`Size mismatch: ${entry.path}`);
  }
  if (sha256(bytes) !== entry.sha256) {
    throw new Error(`SHA-256 mismatch: ${entry.path}`);
  }
}

console.log(
  `Verified ${manifest.d1.tables.length} D1 tables (${manifest.d1.totalRows} rows) and ` +
    `${manifest.r2.totalObjects} R2 objects (${manifest.r2.totalBytes} bytes).`,
);
