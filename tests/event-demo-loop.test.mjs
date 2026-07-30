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
  assert.ok(data.claims.some((claim) => claim.verificationEvidence.length > 0));
  assert.ok(data.claims.every((claim) => claim.contentStatus && claim.priceStatus));
  assert.match(component, /搜索 Claim、公司、发言人或股票代码/);
  assert.match(component, /跨 Claim 比较/);
  assert.match(component, /WeChat Group 原始口径/);
  assert.match(component, /BBG 价格事件窗/);
  assert.match(data.methodology.contentBoundary, /价格已核验不等于 Claim 内容已核验/);
  assert.doesNotMatch(component, /investmentReadThrough|投资含义|相似度|需求判断/);
  assert.match(sync, /event_study_bbg_baseline/);
  assert.match(sync, /comparison_rows/);
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
