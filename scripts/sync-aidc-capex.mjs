import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const trackedDir = resolve(projectRoot, "data", "aidc-capex");
const publicDir = resolve(projectRoot, "public", "data", "aidc-capex");
const trackedDashboard = resolve(trackedDir, "dashboard.json");
const trackedManifest = resolve(trackedDir, "manifest.json");
const publicDashboard = resolve(publicDir, "dashboard.json");
const publicManifest = resolve(publicDir, "manifest.json");
const researchRoot = process.env.AIDC_RESEARCH_ROOT
  ? resolve(process.env.AIDC_RESEARCH_ROOT)
  : resolve(projectRoot, "..", "aidc-capex-tracker");
const epochDir = resolve(researchRoot, "data", "epoch-ai", "extracted");
const epochReadme = resolve(researchRoot, "data", "epoch-ai", "README.md");

const inputFiles = {
  campuses: "data_centers.csv",
  timelines: "data_center_timelines.csv",
  chips: "data_center_chip_quantities.csv",
  chillers: "data_center_chillers.csv",
  coolingTowers: "data_center_cooling_towers.csv",
  hardware: "ml_hardware.csv",
  chipOwnerQuarters: "ai_chip_owners/quarters_by_chip_type.csv",
  chipOwnerCumulative: "ai_chip_owners/cumulative_by_chip_type.csv",
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const text = source.replace(/^\uFEFF/, "");

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((value) => value.trim())) rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values[index] ?? ""]),
  ));
}

function number(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 2) {
  if (value === null || !Number.isFinite(value)) return null;
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function sum(values) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function annotated(value = "") {
  const confidence = value.match(/#(confident|likely|speculative)/i)?.[1]?.toLowerCase();
  return {
    value: value.replace(/\s*#(?:confident|likely|speculative)\b/gi, "").trim(),
    confidence: confidence === "confident"
      ? "high"
      : confidence === "likely"
        ? "medium"
        : confidence === "speculative"
          ? "low"
          : "unknown",
  };
}

function canonicalOwner(value) {
  const cleaned = annotated(value).value;
  if (/^(SpaceXAI|xAI)$/i.test(cleaned)) return "xAI";
  if (/^Amazon(?: AWS)?$/i.test(cleaned)) return "Amazon";
  if (/^Google(?: Cloud)?$/i.test(cleaned)) return "Google";
  return cleaned || "Unknown";
}

function splitAnnotatedList(value = "") {
  return value.split(",").map((item) => annotated(item).value).filter(Boolean);
}

function projectId(name) {
  return `aidc-${sha256(name).slice(0, 12)}`;
}

function quarter(date) {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  return `${parsed.getUTCFullYear()}Q${Math.floor(parsed.getUTCMonth() / 3) + 1}`;
}

function quarterEnd(key) {
  const [yearText, quarterText] = key.split("Q");
  const year = Number(yearText);
  const quarterIndex = Number(quarterText);
  return new Date(Date.UTC(year, quarterIndex * 3, 0)).toISOString().slice(0, 10);
}

function quarterRange(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const rows = [];
  let year = start.getUTCFullYear();
  let q = Math.floor(start.getUTCMonth() / 3) + 1;
  const endYear = end.getUTCFullYear();
  const endQ = Math.floor(end.getUTCMonth() / 3) + 1;
  while (year < endYear || (year === endYear && q <= endQ)) {
    rows.push(`${year}Q${q}`);
    q += 1;
    if (q === 5) {
      q = 1;
      year += 1;
    }
  }
  return rows;
}

function ageDays(observationDate, cutoff) {
  if (!observationDate) return null;
  return Math.max(0, Math.round(
    (Date.parse(`${cutoff}T00:00:00Z`) - Date.parse(`${observationDate}T00:00:00Z`))
      / 86_400_000,
  ));
}

function freshness(observationDate, cutoff) {
  const days = ageDays(observationDate, cutoff);
  if (days === null || !Number.isFinite(days)) return "unknown";
  if (days <= 120) return "current";
  if (days <= 240) return "aging";
  return "stale";
}

function baselineStatus(currentItMw, latestRecord) {
  if ((currentItMw || 0) > 0) return "operational";
  if (latestRecord?.["Construction status"]) return "construction";
  return "unknown";
}

function publisherFor(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const known = {
      "sec.gov": "U.S. SEC",
      "wsj.com": "The Wall Street Journal",
      "x.com": "X",
      "epoch.ai": "Epoch AI",
      "about.fb.com": "Meta",
      "blogs.microsoft.com": "Microsoft",
      "amazon.com": "Amazon",
      "google.com": "Google",
    };
    return known[host] || host;
  } catch {
    return "Unknown publisher";
  }
}

function sourceType(url) {
  const host = (() => {
    try { return new URL(url).hostname; } catch { return ""; }
  })();
  if (/sec\.gov|gov$|\.gov\./.test(host)) return "regulatory";
  if (/microsoft|google|amazon|meta|oracle|x\.ai|spacex/.test(host)) return "company";
  if (/x\.com|twitter/.test(host)) return "social";
  return "public-reference";
}

function markdownSources(value = "") {
  const sources = [];
  const expression = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  for (const match of value.matchAll(expression)) {
    sources.push({ title: match[1].trim(), url: match[2].trim() });
  }
  return sources;
}

function latestAtOrBefore(records, date) {
  return records
    .filter((record) => record.Date <= date)
    .sort((a, b) => b.Date.localeCompare(a.Date))[0] || null;
}

function formatHkt(iso) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} HKT`;
}

async function readInputs() {
  const entries = await Promise.all(Object.entries(inputFiles).map(async ([key, relativePath]) => {
    const path = resolve(epochDir, relativePath);
    const bytes = await readFile(path);
    return [key, {
      key,
      relativePath: `data/epoch-ai/extracted/${relativePath}`,
      bytes,
      sha256: sha256(bytes),
      rows: parseCsv(bytes.toString("utf8")),
    }];
  }));
  return Object.fromEntries(entries);
}

async function copyTrackedFallback() {
  const [dashboard, manifest] = await Promise.all([
    readFile(trackedDashboard),
    readFile(trackedManifest),
  ]);
  const parsed = JSON.parse(dashboard.toString("utf8"));
  if (parsed.schemaVersion !== "aidc-capex.v1") {
    throw new Error("Tracked AI Capex snapshot has an unsupported schema.");
  }
  await mkdir(publicDir, { recursive: true });
  await Promise.all([
    writeFile(publicDashboard, dashboard),
    writeFile(publicManifest, manifest),
  ]);
  console.log(`AIDC research repository unavailable; reused tracked ${parsed.recordCounts.campuses} campus snapshot.`);
}

let inputs;
try {
  inputs = await readInputs();
} catch (error) {
  try {
    await copyTrackedFallback();
    process.exit(0);
  } catch {
    throw new Error(
      `AI Capex source data is unavailable at ${researchRoot} and no tracked fallback exists.`,
      { cause: error },
    );
  }
}

const readme = await readFile(epochReadme, "utf8");
const downloadedOn = readme.match(/Downloaded on (\d{4}-\d{2}-\d{2})/)?.[1] || "2026-07-29";
const dataCutoff = process.env.AIDC_DATA_CUTOFF || downloadedOn;
const generatedAt = process.env.AIDC_SYNCED_AT || new Date().toISOString();
const modelVersion = `epoch-baseline-${downloadedOn}`;
const campuses = inputs.campuses.rows;
const timelineRows = inputs.timelines.rows;
const chipRows = inputs.chips.rows;
const campusNames = new Set(campuses.map((row) => row.Name));
const timelinesByCampus = new Map();
const chipsByCampus = new Map();

for (const row of timelineRows) {
  if (!timelinesByCampus.has(row["Data center"])) timelinesByCampus.set(row["Data center"], []);
  timelinesByCampus.get(row["Data center"]).push(row);
}
for (const records of timelinesByCampus.values()) {
  records.sort((a, b) => a.Date.localeCompare(b.Date));
}
for (const row of chipRows) {
  if (!chipsByCampus.has(row["Data center"])) chipsByCampus.set(row["Data center"], []);
  chipsByCampus.get(row["Data center"]).push(row);
}
for (const records of chipsByCampus.values()) {
  records.sort((a, b) => a.Date.localeCompare(b.Date));
}

const sources = [
  {
    id: "S001",
    publisher: "Epoch AI",
    title: "AI Data Centers",
    sourceType: "open-dataset",
    sourceDate: null,
    observationDate: dataCutoff,
    accessedAt: downloadedOn,
    urlOrAssetId: "https://epoch.ai/data/ai-data-centers",
    rightsStatus: "CC BY 4.0",
    verificationStatus: "official-dataset-snapshot",
  },
  {
    id: "S002",
    publisher: "Epoch AI",
    title: "AI Data Centers documentation",
    sourceType: "methodology",
    sourceDate: null,
    observationDate: dataCutoff,
    accessedAt: downloadedOn,
    urlOrAssetId: "https://epoch.ai/data/data-centers-documentation",
    rightsStatus: "CC BY 4.0",
    verificationStatus: "official-methodology",
  },
  {
    id: "S003",
    publisher: "Epoch AI",
    title: "Data on AI Chip Owners",
    sourceType: "open-dataset",
    sourceDate: null,
    observationDate: dataCutoff,
    accessedAt: downloadedOn,
    urlOrAssetId: "https://epoch.ai/data/ai-chip-owners",
    rightsStatus: "CC BY 4.0",
    verificationStatus: "official-dataset-snapshot",
  },
  {
    id: "S004",
    publisher: "Epoch AI",
    title: "Data on Machine Learning Hardware",
    sourceType: "open-dataset",
    sourceDate: null,
    observationDate: dataCutoff,
    accessedAt: downloadedOn,
    urlOrAssetId: "https://epoch.ai/data/machine-learning-hardware",
    rightsStatus: "CC BY 4.0",
    verificationStatus: "official-dataset-snapshot",
  },
];
const sourceIdByUrl = new Map(sources.map((source) => [source.urlOrAssetId, source.id]));

function registerSource(candidate, observationDate) {
  if (sourceIdByUrl.has(candidate.url)) return sourceIdByUrl.get(candidate.url);
  const id = `S${String(sources.length + 1).padStart(3, "0")}`;
  sourceIdByUrl.set(candidate.url, id);
  sources.push({
    id,
    publisher: publisherFor(candidate.url),
    title: candidate.title,
    sourceType: sourceType(candidate.url),
    sourceDate: null,
    observationDate,
    accessedAt: downloadedOn,
    urlOrAssetId: candidate.url,
    rightsStatus: "link-only; third-party rights not granted by Epoch licence",
    verificationStatus: "referenced-by-epoch",
  });
  return id;
}

const projects = campuses.map((row) => {
  const records = timelinesByCampus.get(row.Name) || [];
  const currentTimeline = latestAtOrBefore(records, dataCutoff);
  const ownerAnnotation = annotated(row.Owner);
  const currentItMw = number(row["Current power (MW)"]);
  const observationDate = currentTimeline?.Date || null;
  const sourceIds = ["S001", "S002"];
  for (const candidate of markdownSources(row["Selected Sources"])) {
    sourceIds.push(registerSource(candidate, observationDate));
  }
  const calculationSheetUrl = /^https?:\/\//.test(row["Calculations sheet"])
    ? row["Calculations sheet"]
    : null;
  if (calculationSheetUrl) {
    sourceIds.push(registerSource({
      title: `${row.Name} calculation sheet`,
      url: calculationSheetUrl,
    }, observationDate));
  }

  return {
    id: projectId(row.Name),
    name: row.Name,
    owner: canonicalOwner(row.Owner),
    ownerRaw: ownerAnnotation.value || null,
    users: splitAnnotatedList(row.Users),
    country: row.Country || "Unknown",
    address: row.Address || null,
    currentItMw,
    currentH100e: number(row["Current H100 equivalents"]),
    estimatedCapitalCostUsdBn: number(row["Current total capital cost (2025 USD billions)"]),
    currentChipTypes: splitAnnotatedList(row["Current chip types"]),
    allChipTypes: splitAnnotatedList(row["All chip types"]),
    status: baselineStatus(currentItMw, currentTimeline),
    statusBasis: "Epoch baseline project snapshot; not a reviewed building-stage classification",
    confidence: ownerAnnotation.confidence,
    confidenceBasis: ownerAnnotation.confidence === "unknown"
      ? "No explicit confidence annotation on the Epoch owner field"
      : "Mapped only from the Epoch owner-field confidence annotation",
    observationDate,
    observationAgeDays: ageDays(observationDate, dataCutoff),
    freshness: freshness(observationDate, dataCutoff),
    latestMilestone: currentTimeline?.["Construction status"] || null,
    calculationSheetUrl,
    sourceIds: [...new Set(sourceIds)],
    timeline: records.map((record) => ({
      date: record.Date,
      quarter: quarter(record.Date),
      period: record.Date <= dataCutoff ? "historical-current" : "epoch-baseline-plan",
      constructionStatus: record["Construction status"] || null,
      buildingsOperational: number(record["Buildings operational"]),
      itMw: number(record["IT power (MW)"]),
      totalPowerMw: number(record["Power (MW)"]),
      h100e: number(record["H100 equivalents"]),
      estimatedCapitalCostUsdBn: number(record["Total capital cost (2025 USD billions)"]),
      sourceIds: ["S001", "S002"],
    })),
    chipQuantities: (chipsByCampus.get(row.Name) || []).map((record) => ({
      date: record.Date,
      chipType: record["Chip type"],
      units: number(record["Number of Units"]),
      chipTypeEvidence: record["Chip type source"] || null,
      unitsEvidence: record["Number of Units source"] || null,
      notes: record.Notes || null,
      sourceIds: ["S001", "S004"],
    })),
  };
});

const ownerMap = new Map();
for (const project of projects) {
  if (!ownerMap.has(project.owner)) {
    ownerMap.set(project.owner, {
      owner: project.owner,
      campuses: 0,
      currentItMw: 0,
      currentH100e: 0,
      estimatedCapitalCostUsdBn: 0,
      sourceIds: ["S001", "S002"],
    });
  }
  const owner = ownerMap.get(project.owner);
  owner.campuses += 1;
  owner.currentItMw += project.currentItMw || 0;
  owner.currentH100e += project.currentH100e || 0;
  owner.estimatedCapitalCostUsdBn += project.estimatedCapitalCostUsdBn || 0;
}
const owners = [...ownerMap.values()]
  .map((owner) => ({
    ...owner,
    currentItMw: round(owner.currentItMw, 1),
    currentH100e: round(owner.currentH100e, 0),
    estimatedCapitalCostUsdBn: round(owner.estimatedCapitalCostUsdBn, 2),
  }))
  .sort((a, b) => b.currentItMw - a.currentItMw);

const statusMap = new Map();
for (const project of projects) {
  if (!statusMap.has(project.status)) {
    statusMap.set(project.status, {
      status: project.status,
      campuses: 0,
      currentItMw: 0,
      sourceIds: ["S001", "S002"],
    });
  }
  const status = statusMap.get(project.status);
  status.campuses += 1;
  status.currentItMw += project.currentItMw || 0;
}
const statusPipeline = [...statusMap.values()].map((status) => ({
  ...status,
  currentItMw: round(status.currentItMw, 1),
}));

const campusTimelineRows = timelineRows.filter((row) => campusNames.has(row["Data center"]));
const timelineStart = campusTimelineRows.map((row) => row.Date).sort()[0];
const timelineEnd = campusTimelineRows.map((row) => row.Date).sort().at(-1);
const cutoffQuarter = quarter(dataCutoff);
const capacityTimeline = quarterRange(timelineStart, timelineEnd).map((key) => {
  const date = quarterEnd(key);
  const effectiveDate = key === cutoffQuarter ? dataCutoff : date;
  const total = sum(projects.map((project) => {
    const records = timelinesByCampus.get(project.name) || [];
    return number(latestAtOrBefore(records, effectiveDate)?.["IT power (MW)"]) || 0;
  }));
  const historical = key <= cutoffQuarter;
  return {
    quarter: key,
    periodEnd: date,
    historicalItMw: historical ? round(total, 1) : null,
    epochBaselinePlannedItMw: key >= cutoffQuarter ? round(total, 1) : null,
    status: historical ? "historical-current" : "epoch-baseline-plan",
    observationDate: historical ? effectiveDate : date,
    sourceIds: ["S001", "S002"],
  };
});

const fileIntegrity = Object.values(inputs).map((input) => ({
  path: input.relativePath,
  sha256: input.sha256,
  bytes: input.bytes.length,
  rows: input.rows.length,
}));
const payload = {
  schemaVersion: "aidc-capex.v1",
  generatedAt,
  syncedAtHkt: formatHkt(generatedAt),
  dataCutoff,
  modelVersion,
  reviewStatus: "epoch-open-data-baseline",
  baselineLabel: "Epoch AI estimates",
  sourceSnapshots: [
    {
      id: "epoch-ai-2026-07-29",
      publisher: "Epoch AI",
      accessedAt: downloadedOn,
      licence: "CC BY 4.0",
      sourceIds: ["S001", "S002", "S003", "S004"],
      files: fileIntegrity,
    },
  ],
  recordCounts: {
    campuses: projects.length,
    timelineRecords: inputs.timelines.rows.length,
    siteChipDateRecords: inputs.chips.rows.length,
    hardwareRecords: inputs.hardware.rows.length,
    chillerRecords: inputs.chillers.rows.length,
    coolingTowerRecords: inputs.coolingTowers.rows.length,
    chipOwnerQuarterRecords: inputs.chipOwnerQuarters.rows.length,
    chipOwnerCumulativeRecords: inputs.chipOwnerCumulative.rows.length,
    sources: sources.length,
    reviewedForecasts: 0,
  },
  fileIntegrity: { algorithm: "sha256", inputs: fileIntegrity },
  knownLimitations: [
    "No reviewed building-level entities, geometry, or stage histories.",
    "No reviewed delay probability or paused-capacity model.",
    "No reviewed next-four-quarter building-level IT-MW forecast.",
    "No reviewed company Capex Momentum signal.",
    "Current power, compute, and capital cost are Epoch estimates, not company-reported accounting Capex.",
  ],
  freshnessMethod: {
    basis: "Observation date relative to data cutoff; Level Grind sync time is not used.",
    currentDays: "0-120",
    agingDays: "121-240",
    staleDays: ">240",
    unknown: "No reliable observation date",
  },
  metricMethods: {
    currentItMw: "Epoch AI current power field, treated as the campus IT-power baseline for this pilot.",
    currentH100e: "Epoch AI current H100-equivalent estimate.",
    estimatedCapitalCostUsdBn: "Epoch AI estimated total capital cost in constant 2025 USD; not company-reported Capex.",
    capacityTimeline: "Latest Epoch project timeline snapshot available at each quarter end; future rows are labelled Epoch baseline plans.",
    confidence: "Mapped only from the confidence annotation attached to the Epoch owner field; it is not a project-wide certainty score.",
  },
  kpis: {
    campuses: projects.length,
    currentItMw: round(sum(projects.map((project) => project.currentItMw)), 1),
    currentH100e: round(sum(projects.map((project) => project.currentH100e)), 0),
    estimatedCapitalCostUsdBn: round(sum(projects.map((project) => project.estimatedCapitalCostUsdBn)), 2),
    observationDate: projects.map((project) => project.observationDate).filter(Boolean).sort().at(-1) || null,
    sourceIds: ["S001", "S002"],
  },
  owners,
  capacityTimeline,
  statusPipeline,
  projects,
  sources,
  reviewedForecasts: [],
};

const dashboardBytes = Buffer.from(`${JSON.stringify(payload)}\n`);
const manifest = {
  schemaVersion: payload.schemaVersion,
  generatedAt,
  dataCutoff,
  modelVersion,
  sourceSnapshots: payload.sourceSnapshots.map(({ id, publisher, accessedAt, licence }) => ({
    id,
    publisher,
    accessedAt,
    licence,
  })),
  recordCounts: payload.recordCounts,
  files: [{
    path: "dashboard.json",
    sha256: sha256(dashboardBytes),
    bytes: dashboardBytes.length,
  }],
};
const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);

await Promise.all([mkdir(trackedDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
await Promise.all([
  writeFile(trackedDashboard, dashboardBytes),
  writeFile(publicDashboard, dashboardBytes),
  writeFile(trackedManifest, manifestBytes),
  writeFile(publicManifest, manifestBytes),
]);

console.log(
  `Synced ${payload.recordCounts.campuses} AI campuses, `
  + `${payload.recordCounts.timelineRecords} timeline records, and `
  + `${payload.recordCounts.sources} sources from ${researchRoot}.`,
);
