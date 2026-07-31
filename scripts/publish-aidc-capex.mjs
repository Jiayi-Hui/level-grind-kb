import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const trackedDir = resolve(projectRoot, "data", "aidc-capex");
const publicDir = resolve(projectRoot, "public", "data", "aidc-capex");
const files = [
  {
    name: "dashboard.json",
    source: resolve(trackedDir, "dashboard.json"),
    target: resolve(publicDir, "dashboard.json"),
  },
  {
    name: "manifest.json",
    source: resolve(trackedDir, "manifest.json"),
    target: resolve(publicDir, "manifest.json"),
  },
  {
    name: "geocodes.json",
    source: resolve(projectRoot, "data", "aidc-capex-geocodes.json"),
    target: resolve(publicDir, "geocodes.json"),
  },
];

const [dashboardBytes, manifestBytes, geocodeBytes] = await Promise.all(
  files.map((file) => readFile(file.source)),
);
const dashboard = JSON.parse(dashboardBytes.toString("utf8"));
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const geocodes = JSON.parse(geocodeBytes.toString("utf8"));

if (dashboard.schemaVersion !== "aidc-capex.v1") {
  throw new Error(`Unsupported AI Capex schema: ${dashboard.schemaVersion || "missing"}.`);
}
if (dashboard.recordCounts?.campuses !== dashboard.projects?.length) {
  throw new Error("AI Capex campus count does not match the published project records.");
}
if (Object.keys(geocodes).length < dashboard.projects.length) {
  throw new Error("AI Capex geocode snapshot is incomplete.");
}

const expectedDashboardHash = manifest.files?.find((file) => file.path === "dashboard.json")?.sha256;
const actualDashboardHash = createHash("sha256").update(dashboardBytes).digest("hex");
if (!expectedDashboardHash || expectedDashboardHash !== actualDashboardHash) {
  throw new Error("AI Capex dashboard checksum does not match its tracked manifest.");
}

await mkdir(publicDir, { recursive: true });
await Promise.all(files.map((file) => copyFile(file.source, file.target)));

console.log(
  `Published portable AI Capex snapshot: ${dashboard.projects.length} campuses, `
  + `${Object.values(geocodes).filter((item) => Number.isFinite(item?.latitude)).length} mapped locations, `
  + `cutoff ${dashboard.dataCutoff}.`,
);
