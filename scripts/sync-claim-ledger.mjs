import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceClaimsPath = resolve(projectRoot, "data/events/wechat-claim-ledger-source.json");
const findingsPath = resolve(projectRoot, "data/events/verification-findings-2026-07-27.json");
const siblingRoot = resolve(projectRoot, "../event-db/data/claim-ledger-alpha-2026-07-28");
const trackedOutput = resolve(projectRoot, "data/events/claim-ledger-dashboard.json");
const publicOutput = resolve(projectRoot, "public/data/claim-ledger-dashboard.json");

const exists = async (path) => fs.access(path).then(() => true, () => false);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const sourceClaimsRaw = await fs.readFile(sourceClaimsPath, "utf8");
const sourceClaims = JSON.parse(sourceClaimsRaw);
const findingsRaw = await fs.readFile(findingsPath, "utf8");
const findings = JSON.parse(findingsRaw);

const sourcePaths = {
  bbg: resolve(siblingRoot, "bbg_baseline/event_study_bbg_baseline.json"),
  comparison: resolve(siblingRoot, "public_rerun/comparison_rows.json"),
  coverage: resolve(siblingRoot, "public_rerun/coverage.json"),
  prices: resolve(siblingRoot, "public_rerun/public_prices.json"),
  summary: resolve(siblingRoot, "public_rerun/summary.json"),
};

const siblingAvailable = (await Promise.all(Object.values(sourcePaths).map(exists))).every(Boolean);

if (!siblingAvailable) {
  if (!(await exists(trackedOutput))) {
    throw new Error(`Claim ledger sources unavailable at ${siblingRoot} and no tracked fallback exists.`);
  }
  await fs.mkdir(dirname(publicOutput), { recursive: true });
  await fs.copyFile(trackedOutput, publicOutput);
  console.log("Claim ledger source repo unavailable; copied the tracked dashboard snapshot.");
  process.exit(0);
}

const [bbgRaw, comparisonRaw, coverageRaw, pricesRaw, summaryRaw] = await Promise.all(
  Object.values(sourcePaths).map((path) => fs.readFile(path, "utf8")),
);
const bbgRows = JSON.parse(bbgRaw);
const comparisonRows = JSON.parse(comparisonRaw);
const coverageRows = JSON.parse(coverageRaw);
const priceRows = JSON.parse(pricesRaw);
const summary = JSON.parse(summaryRaw);
const dataCutoff = priceRows
  .map((row) => row.Date)
  .filter(Boolean)
  .sort()
  .at(-1) || "2026-07-28";

const byEvent = (rows) => rows.reduce((map, row) => {
  const id = row["Event ID"];
  if (!map.has(id)) map.set(id, []);
  map.get(id).push(row);
  return map;
}, new Map());

const comparisonByKey = new Map(
  comparisonRows.map((row) => [`${row["Event ID"]}::${row.Ticker}`, row]),
);
const coverageByTicker = new Map(coverageRows.map((row) => [row["BBG ticker"], row]));
const priceByTicker = priceRows.reduce((map, row) => {
  if (!map.has(row.Ticker)) map.set(row.Ticker, []);
  map.get(row.Ticker).push({
    date: row.Date,
    close: row.PX_LAST,
    source: row.Source,
    publicSymbol: row["Public symbol"],
  });
  return map;
}, new Map());
const bbgByEvent = byEvent(bbgRows);

const evidenceByEvent = new Map();
for (const finding of findings.findings) {
  for (const eventId of finding.eventIds) {
    if (!evidenceByEvent.has(eventId)) evidenceByEvent.set(eventId, []);
    evidenceByEvent.get(eventId).push({
      findingId: finding.findingId,
      verificationStatus: finding.verificationStatus,
      summary: finding.summary,
      recommendedEventDefinition: finding.recommendedEventDefinition,
      nextEvidenceNeeded: finding.nextEvidenceNeeded,
      bbgEvidence: finding.bbgEvidence,
      dymonEvidence: finding.dymonEvidence,
    });
  }
}

const horizon = (row, label) => ({
  date: row[`${label} date`] ?? null,
  close: row[`${label} PX`] ?? null,
  return: row[`${label} return`] ?? null,
  abnormal: row[`${label} abnormal`] ?? null,
  benchmarkClose: row[`Benchmark ${label} PX`] ?? null,
});

const claims = sourceClaims.claims.map((claim) => {
  const mappings = (bbgByEvent.get(claim.eventId) || []).map((row) => {
    const comparison = comparisonByKey.get(`${claim.eventId}::${row.Ticker}`);
    const coverage = coverageByTicker.get(row.Ticker);
    return {
      mappingType: row["Mapping type"],
      ticker: row.Ticker,
      security: row.Security,
      market: row.Market,
      benchmark: row.Benchmark,
      mappingRationale: row["Mapping rationale"],
      eventSession: row["Event session"],
      baseDate: row["Base date"],
      baseClose: row["Base PX"],
      status: row.Status,
      returns: {
        t0: horizon(row, "T+0"),
        t1: horizon(row, "T+1"),
        t3: horizon(row, "T+3"),
        t5: horizon(row, "T+5"),
      },
      publicCheck: comparison ? {
        status: comparison["Public recompute status"],
        priceSource: comparison["Public source"],
        benchmarkSource: comparison["Benchmark source"],
        abnormalDiffBp: {
          t0: comparison["T+0 abnormal diff bp"] ?? null,
          t1: comparison["T+1 abnormal diff bp"] ?? null,
          t3: comparison["T+3 abnormal diff bp"] ?? null,
          t5: comparison["T+5 abnormal diff bp"] ?? null,
        },
      } : null,
      publicSymbol: coverage?.["Mapped public symbol"] ?? null,
    };
  });

  const verificationEvidence = evidenceByEvent.get(claim.eventId) || [];
  return {
    ...claim,
    contentStatus: claim.verificationStatus,
    priceStatus: mappings.length ? "BBG event window available" : "No mapped security",
    verificationEvidence,
    mappings,
  };
});

const securities = [...priceByTicker.entries()].map(([ticker, prices]) => ({
  ticker,
  publicSymbol: prices[0]?.publicSymbol ?? null,
  source: prices[0]?.source ?? null,
  prices: prices.sort((a, b) => a.date.localeCompare(b.date)),
}));

const payload = {
  schemaVersion: "claim-ledger.v1",
  generatedAt: new Date().toISOString(),
  dataCutoff,
  sourceSnapshots: [
    {
      id: "wechat-claim-ledger",
      title: sourceClaims.sourceWorkbook,
      kind: "group-chat claim date ledger",
      sha256: sha256(sourceClaimsRaw),
    },
    {
      id: "bbg-event-study",
      title: "event_study_bbg_baseline.json",
      kind: "Bloomberg Desktop-derived event-window output",
      sha256: sha256(bbgRaw),
    },
    {
      id: "public-price-rerun",
      title: "comparison_rows.json",
      kind: "AKShare/yfinance cross-check",
      sha256: sha256(comparisonRaw),
    },
  ],
  recordCounts: {
    claims: claims.length,
    exactTimestampClaims: claims.filter((claim) => claim.dateEvidenceType === "原始群聊时间戳").length,
    mappedClaims: claims.filter((claim) => claim.mappings.length > 0).length,
    claimSecurityMappings: bbgRows.length,
    securitiesWithPublicPrices: securities.length,
    verificationFindings: findings.findings.length,
  },
  methodology: {
    contentBoundary: "群聊 Claim 与核验状态分开保存；价格已核验不等于 Claim 内容已核验。",
    bbgBoundary: "事件窗价格来自 Bloomberg Desktop 衍生输出，不包含可再分发的 Bloomberg 原始日频表。",
    publicBoundary: "公开价格用于复核和日常分诊；韩国股票、TOPIX 代理及公司行动仍需人工升级。",
    horizons: ["T+0", "T+1", "T+3", "T+5"],
  },
  claims,
  securities,
  publicRerunSummary: summary,
};

const serialized = `${JSON.stringify(payload)}\n`;
await fs.mkdir(dirname(trackedOutput), { recursive: true });
await fs.mkdir(dirname(publicOutput), { recursive: true });
await fs.writeFile(trackedOutput, serialized, "utf8");
await fs.writeFile(publicOutput, serialized, "utf8");

console.log(
  `Synced ${payload.recordCounts.claims} claims, ${payload.recordCounts.claimSecurityMappings} mappings, and ${payload.recordCounts.securitiesWithPublicPrices} price series.`,
);
