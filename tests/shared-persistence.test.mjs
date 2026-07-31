import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships shared Claim persistence with conflict and audit protection", async () => {
  const [migration, endpoint, component, edgeApp] = await Promise.all([
    readFile(new URL("../infra/shared-data/postgres/002_weekend_shared_state.sql", import.meta.url), "utf8"),
    readFile(new URL("../public/cloud-functions/api/shared-claims.js", import.meta.url), "utf8"),
    readFile(new URL("../app/event-research.tsx", import.meta.url), "utf8"),
    readFile(new URL("../deploy/edgeone-demo/src/main.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /CREATE TABLE IF NOT EXISTS team_claim_overlays/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /LG_CONFLICT/);
  assert.match(migration, /INSERT INTO audit_log/);
  assert.match(migration, /TO service_role/);
  assert.match(endpoint, /clerkIdentity/);
  assert.match(endpoint, /rpc\/mutate_team_claim_overlay/);
  assert.match(endpoint, /expectedVersion/);
  assert.match(component, /共享数据库尚未就绪 · 已阻止本地假保存/);
  assert.match(component, /level-grind\.claim-edits\.migrated/);
  assert.match(edgeApp, /persistence="shared"/);
});

test("records DeepSeek usage without storing full prompts", async () => {
  const [migration, agentFunction] = await Promise.all([
    readFile(new URL("../infra/shared-data/postgres/002_weekend_shared_state.sql", import.meta.url), "utf8"),
    readFile(new URL("../public/cloud-functions/api/agent-chat.js", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /CREATE TABLE IF NOT EXISTS ai_usage_events/);
  assert.match(migration, /thinking_enabled boolean/);
  assert.match(migration, /latency_ms integer/);
  assert.match(agentFunction, /recordAiUsage/);
  assert.match(agentFunction, /requestId/);
  assert.doesNotMatch(migration, /prompt_text|question_text|full_prompt/);
});
