import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships the real Claim ledger with separate content and price evidence", async () => {
  const [component, snapshot, source, sync] = await Promise.all([
    readFile(new URL("../app/event-research.tsx", import.meta.url), "utf8"),
    readFile(new URL("../data/events/claim-ledger-dashboard.json", import.meta.url), "utf8"),
    readFile(new URL("../data/events/wechat-claim-ledger-source.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/sync-claim-ledger.mjs", import.meta.url), "utf8"),
  ]);
  const data = JSON.parse(snapshot);
  const claims = JSON.parse(source);
  assert.equal(data.schemaVersion, "claim-ledger.v1");
  assert.equal(data.recordCounts.claims, 45);
  assert.equal(data.recordCounts.claimSecurityMappings, 88);
  assert.equal(data.recordCounts.securitiesWithPublicPrices, 48);
  assert.equal(claims.claims.length, 45);
  assert.ok(data.claims.some((claim) => claim.speaker === "Allen" && claim.claimTimeHkt));
  assert.ok(["CLM-SEED-EVT-0001", "CLM-SEED-EVT-0002", "CLM-SEED-EVT-0003", "CLM-SEED-EVT-0004"]
    .every((id) => data.claims.find((claim) => claim.claimId === id)?.speaker === "BossX"));
  assert.ok(data.claims.every((claim) => claim.speaker !== "Xu Lei"));
  assert.ok(data.claims.some((claim) => claim.verificationEvidence.length > 0));
  assert.ok(data.claims.every((claim) => claim.contentStatus && claim.priceStatus));
  assert.ok(data.claims.every((claim) => claim.mappings.every((mapping) => Object.values(mapping.returns).every((horizon) => (
    horizon.date && horizon.close !== null ? horizon.return !== null : horizon.return === null
  )))));
  assert.match(component, /语义搜索 Claim、公司、行业、主题或股票代码/);
  assert.match(component, /T\+0/);
  assert.match(component, /T\+1/);
  assert.match(component, /T\+3/);
  assert.match(component, /T\+5/);
  assert.match(component, /localStorage/);
  assert.match(component, /LineChart/);
  assert.match(component, /ReferenceArea/);
  assert.match(component, /编辑/);
  assert.match(component, /删除/);
  assert.match(component, /添加 Claim/);
  assert.match(component, /按最深回撤/);
  assert.match(component, /全部公司/);
  assert.match(component, /全部行业 \/ 主题/);
  assert.match(data.methodology.contentBoundary, /价格已核验不等于 Claim 内容已核验/);
  assert.doesNotMatch(component, /investmentReadThrough|投资含义|相似度|需求判断/);
  assert.match(sync, /event_study_bbg_baseline/);
  assert.match(sync, /comparison_rows/);
  assert.match(sync, /hasObservedPrice/);
  assert.match(sync, /publicSpeakerAlias/);
});

test("refreshes event price paths through a bounded Yahoo Finance proxy", async () => {
  const [component, marketRoute] = await Promise.all([
    readFile(new URL("../app/event-research.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/cloud-functions/api/market-prices.js", import.meta.url), "utf8"),
  ]);
  assert.match(component, /\/api\/market-prices\?symbols=/);
  assert.match(component, /withYahooReturns/);
  assert.match(component, /60 \* 60 \* 1000/);
  assert.match(component, /Yahoo Finance 暂不可用，使用已核验快照/);
  assert.match(marketRoute, /query1\.finance\.yahoo\.com\/v8\/finance\/chart/);
  assert.match(marketRoute, /query1\.finance\.yahoo\.com\/v8\/finance\/spark/);
  assert.match(marketRoute, /fetchYahooSparkSeries/);
  assert.match(marketRoute, /symbols\.length > 10/);
  assert.match(marketRoute, /s-maxage=3600/);
  assert.doesNotMatch(marketRoute, /API_KEY|SECRET/);
});

test("ships a secret-protected idempotent WeChat claim inbox", async () => {
  const [route, workspace, example] = await Promise.all([
    readFile(new URL("../app/api/claims/inbox/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/research-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../dev.vars.example", import.meta.url), "utf8"),
  ]);
  assert.match(route, /x-claim-ingest-secret/i);
  assert.match(route, /CLAIM_INGEST_SECRET/);
  assert.match(route, /ON CONFLICT\(id\) DO UPDATE/);
  assert.match(route, /wechat:/);
  assert.match(workspace, /3_000/);
  assert.match(workspace, /EventResearch/);
  assert.match(example, /CLAIM_INGEST_SECRET/);
});
