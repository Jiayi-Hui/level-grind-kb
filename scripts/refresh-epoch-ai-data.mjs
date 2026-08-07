import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extractedDir = resolve(projectRoot, "data", "epoch-ai", "extracted");
const rawDir = resolve(projectRoot, "data", "epoch-ai", "raw");
const manifestPath = resolve(projectRoot, "data", "epoch-ai", "daily-refresh.json");
const downloadUrl = "https://epoch.ai/data/data_centers/data_centers.zip";
const requiredFiles = [
  "data_centers.csv",
  "data_center_timelines.csv",
  "data_center_chip_quantities.csv",
  "data_center_chillers.csv",
  "data_center_cooling_towers.csv",
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function csvRecordCount(bytes) {
  const text = new TextDecoder().decode(bytes).replace(/^\uFEFF/, "");
  let rows = 0;
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (text[index] === "\n" && !quoted) rows += 1;
  }
  return Math.max(0, rows - 1);
}

const response = await fetch(downloadUrl, {
  headers: { "User-Agent": "Level-Grind-AIDC-Sync/1.0 (+https://level-grind.com)" },
});
if (!response.ok) throw new Error(`Epoch AI download failed with HTTP ${response.status}.`);
const archive = new Uint8Array(await response.arrayBuffer());
const entries = unzipSync(archive);

for (const fileName of requiredFiles) {
  if (!entries[fileName]?.length) throw new Error(`Epoch AI archive is missing ${fileName}.`);
}

const currentCampusPath = resolve(extractedDir, "data_centers.csv");
const currentCampusCount = await readFile(currentCampusPath)
  .then((bytes) => csvRecordCount(bytes))
  .catch(() => 0);
const nextCampusCount = csvRecordCount(entries["data_centers.csv"]);
if (nextCampusCount < currentCampusCount) {
  throw new Error(`Epoch AI campus count regressed from ${currentCampusCount} to ${nextCampusCount}; refusing to publish.`);
}

await Promise.all([mkdir(extractedDir, { recursive: true }), mkdir(rawDir, { recursive: true })]);
await Promise.all(requiredFiles.map((fileName) => writeFile(resolve(extractedDir, fileName), entries[fileName])));
await writeFile(resolve(rawDir, "data_centers.zip"), archive);

const refreshedAt = new Date().toISOString();
const files = Object.fromEntries(requiredFiles.map((fileName) => [fileName, {
  rows: csvRecordCount(entries[fileName]),
  bytes: entries[fileName].byteLength,
  sha256: sha256(entries[fileName]),
}]));
await writeFile(manifestPath, `${JSON.stringify({
  schemaVersion: "epoch-ai-refresh.v1",
  source: downloadUrl,
  refreshedAt,
  license: "CC BY 4.0; credit Epoch AI",
  previousCampusCount: currentCampusCount,
  campusCount: nextCampusCount,
  archiveSha256: sha256(archive),
  files,
}, null, 2)}\n`);

console.log(`Epoch AI refresh complete: ${currentCampusCount} -> ${nextCampusCount} campuses.`);
