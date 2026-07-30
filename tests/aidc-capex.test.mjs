import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardBytes = await readFile("data/aidc-capex/dashboard.json");
const publicBytes = await readFile("public/data/aidc-capex/dashboard.json");
const dashboard = JSON.parse(dashboardBytes.toString("utf8"));
const manifest = JSON.parse(await readFile("data/aidc-capex/manifest.json", "utf8"));
const component = await readFile("app/ai-capex.tsx", "utf8");
const styles = await readFile("app/globals.css", "utf8");
const workspace = await readFile("app/research-workspace.tsx", "utf8");
const i18n = await readFile("app/i18n.ts", "utf8");
const script = await readFile("scripts/sync-aidc-capex.mjs", "utf8");
const geocodeScript = await readFile("scripts/geocode-aidc-capex.mjs", "utf8");
const geocodes = JSON.parse(await readFile("data/aidc-capex-geocodes.json", "utf8"));

test("publishes a versioned and checksummed Epoch AI baseline", () => {
  assert.equal(dashboard.schemaVersion, "aidc-capex.v1");
  assert.equal(dashboard.dataCutoff, "2026-07-29");
  assert.equal(dashboard.recordCounts.campuses, 75);
  assert.equal(dashboard.recordCounts.timelineRecords, 424);
  assert.equal(dashboard.recordCounts.siteChipDateRecords, 205);
  assert.equal(dashboard.recordCounts.hardwareRecords, 176);
  assert.equal(dashboard.recordCounts.reviewedForecasts, 0);
  assert.deepEqual(dashboard.reviewedForecasts, []);
  assert.deepEqual(dashboardBytes, publicBytes);
  assert.equal(
    manifest.files[0].sha256,
    createHash("sha256").update(dashboardBytes).digest("hex"),
  );
  assert.ok(dashboard.fileIntegrity.inputs.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256)));
});

test("keeps project metrics, evidence, dates, and forecast periods traceable", () => {
  const sourceIds = new Set(dashboard.sources.map((source) => source.id));
  assert.ok(dashboard.projects.every((project) => project.sourceIds.every((id) => sourceIds.has(id))));
  assert.ok(dashboard.projects.every((project) => ["current", "aging", "stale", "unknown"].includes(project.freshness)));
  assert.ok(dashboard.projects.some((project) => project.freshness === "stale"));
  assert.ok(dashboard.capacityTimeline.some((point) => point.status === "historical-current" && point.historicalItMw !== null));
  assert.ok(dashboard.capacityTimeline.some((point) => point.status === "epoch-baseline-plan" && point.epochBaselinePlannedItMw !== null));
  assert.ok(dashboard.projects.some((project) => project.timeline.some((point) => point.period === "epoch-baseline-plan")));
  assert.match(dashboard.metricMethods.estimatedCapitalCostUsdBn, /not company-reported Capex/i);
  assert.ok(dashboard.knownLimitations.some((item) => /No reviewed.*forecast/i.test(item)));
});

test("adds a compact AI Capex workspace with real matrix and mapped projects", () => {
  assert.match(workspace, /type View = .*"events" \| "aidc" \| "models"/);
  assert.match(workspace, /aidc: "▥"/);
  assert.match(workspace, /active === "aidc".*<AICapex language=\{language\}/s);
  for (const nav of ["inbox", "library", "events", "aidc", "models", "assistant", "settings"]) {
    assert.match(i18n, new RegExp(`${nav}:`));
  }
  assert.ok(i18n.indexOf('events: "Event DB"') < i18n.indexOf('aidc: "AI Capex"'));
  assert.ok(i18n.indexOf('aidc: "AI Capex"') < i18n.indexOf('models: "Model workbench"'));
  assert.match(i18n, /追踪 AI 数据中心建设、未来容量与实物 Capex 动能/);
  assert.match(component, /Project matrix|项目矩阵/);
  assert.match(component, /WorldMap/);
  assert.match(component, /geocodes\.json/);
  assert.match(component, /setOwner/);
  assert.match(component, /setCountry/);
  assert.match(component, /setStatus/);
  assert.doesNotMatch(component, /setConfidence/);
  assert.doesNotMatch(component, /setFreshness/);
  assert.match(component, /loading|Loading/);
  assert.match(component, /aidc-state-error/);
  assert.match(component, /aidc-empty-state/);
  assert.match(component, /地址待补/);
  assert.match(styles, /\.freshness-stale/);
  assert.ok(Object.values(geocodes).filter((entry) => entry.latitude !== null).length >= 50);
  assert.match(geocodeScript, /nominatim\.openstreetmap\.org/);
  assert.match(geocodeScript, /retry-unresolved/);
});

test("sync is build-time only and supports a tracked fallback", () => {
  assert.match(script, /AIDC_RESEARCH_ROOT/);
  assert.match(script, /copyTrackedFallback/);
  assert.match(script, /public.*aidc-capex/);
  assert.doesNotMatch(component, /csv|aidc-capex-tracker/i);
  assert.match(component, /fetch\("\/data\/aidc-capex\/dashboard\.json"/);
});
