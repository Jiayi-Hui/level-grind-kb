import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships historical event reactions and an investment read-through", async () => {
  const [component, snapshot] = await Promise.all([
    readFile(new URL("../app/event-research.tsx", import.meta.url), "utf8"),
    readFile(new URL("../data/events/event-research.json", import.meta.url), "utf8"),
  ]);
  const data = JSON.parse(snapshot);
  assert.equal(data.events.length, 10);
  assert.equal(data.eventReturns.length, 410);
  assert.ok(data.eventPricePaths.length >= 180);
  assert.match(component, /跨事件搜索/);
  assert.match(component, /全部公司/);
  assert.match(component, /全部行业/);
  assert.match(component, /全部季度/);
  assert.match(component, /当前筛选/);
  assert.match(component, /primaryIndustry/);
  assert.match(component, /来源.*WeChat Group/);
  assert.match(component, /companyTicker/);
  assert.match(component, /事件后股价路径/);
  assert.match(component, /投资含义/);
  assert.match(component, /研究辅助，不构成自动买卖指令/);
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
