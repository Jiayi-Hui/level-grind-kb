import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const workflow = await readFile(".github/workflows/production-edgeone.yml", "utf8");
const publishScript = await readFile("scripts/publish-aidc-capex.mjs", "utf8");
const claimPublishScript = await readFile("scripts/publish-claim-ledger.mjs", "utf8");
const databaseContract = await readFile("infra/shared-data/postgres/001_shared_research.sql", "utf8");
const handover = await readFile("docs/GITHUB_PRODUCTION_AND_WORK_COMPUTER_HANDOVER.md", "utf8");

test("production build is portable and does not refresh external research sources", () => {
  assert.match(packageJson.scripts["edgeone-demo:build"], /aidc:publish/);
  assert.match(packageJson.scripts["edgeone-demo:build"], /claims:publish/);
  assert.doesNotMatch(packageJson.scripts["edgeone-demo:build"], /geocode-aidc-capex|aidc:sync|claims:sync/);
  assert.match(packageJson.scripts["edgeone-demo:build:research"], /aidc:sync/);
  assert.match(packageJson.scripts["edgeone-demo:build:research"], /geocode-aidc-capex/);
  assert.match(publishScript, /checksum does not match/);
  assert.match(publishScript, /aidc-capex-geocodes\.json/);
  assert.match(claimPublishScript, /Claim ledger count does not match/);
});

test("production branch is the only automatic EdgeOne deployment source", () => {
  assert.match(workflow, /branches:\s*\n\s*- production/);
  assert.match(workflow, /npm run edgeone-demo:build/);
  assert.match(workflow, /EDGEONE_API_TOKEN/);
  assert.match(workflow, /level-grind-hk-demo/);
  assert.match(workflow, /https:\/\/level-grind\.com/);
  assert.doesNotMatch(workflow, /chatgpt\.site/);
});

test("shared-data contract preserves privacy, versioning, audit, and background jobs", () => {
  for (const table of [
    "research_projects",
    "research_chats",
    "research_messages",
    "knowledge_items",
    "claims",
    "events",
    "market_price_points",
    "aidc_projects",
    "aidc_observations",
    "reports",
    "model_workbooks",
    "vector_documents",
    "background_jobs",
    "audit_log",
  ]) {
    assert.match(databaseContract, new RegExp(`CREATE TABLE ${table}`));
  }
  assert.match(databaseContract, /scope data_scope/);
  assert.match(databaseContract, /version integer/);
  assert.match(databaseContract, /deleted_at timestamptz/);
  assert.match(handover, /Do not host the shared database on either laptop/);
});
