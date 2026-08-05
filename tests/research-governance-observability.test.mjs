import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("AskAI streams visible stages, keeps metadata-only telemetry, and uses the EdgeOne maximum request window", async () => {
  const [agent, ui, edgeone] = await Promise.all([
    read("public/cloud-functions/api/agent-chat.js"),
    read("app/agentic-research.tsx"),
    read("edgeone.json"),
  ]);
  for (const stage of ["auth", "retrieving_context", "retrieving_web", "provider_connected", "first_token", "complete", "error"]) {
    assert.match(agent, new RegExp(stage));
  }
  assert.match(agent, /level-grind-telemetry/);
  assert.doesNotMatch(agent, /telemetryStore\.put\([^\n]+question/);
  assert.match(ui, /正在查询团队知识库/);
  assert.match(ui, /正在联网验证/);
  assert.equal(JSON.parse(edgeone).cloudFunctions.maxDuration, 120);
});

test("shared research records are owner-or-manager editable, audited, and expose contribution review state", async () => {
  const [store, contribution, idea] = await Promise.all([
    read("public/cloud-functions/api/_edgeone-research-store.js"),
    read("deploy/edgeone-demo/src/contribution-strip.tsx"),
    read("deploy/edgeone-demo/src/idea-book.tsx"),
  ]);
  assert.match(store, /function canEdit/);
  assert.match(store, /return record\.owner\?\.user_id === actor\.subject/);
  assert.match(store, /privateTeamResearchContext/);
  assert.match(store, /privateTeamEvidence: true/);
  assert.match(store, /title: `\[Private team \$\{record\.resource/);
  assert.match(store, /只有记录贡献者或成员管理员可以修改/);
  assert.match(store, /soft_delete/);
  assert.match(store, /attachment_complete/);
  assert.match(contribution, /我的贡献/);
  assert.match(contribution, /PM Review/);
  assert.match(idea, /PM Follow-up/);
  assert.match(idea, /Validation/);
  assert.match(idea, /Tracking/);
});

test("private research intake is repeatable and excluded from Git", async () => {
  const [gitignore, script] = await Promise.all([read(".gitignore"), read("scripts/prepare-private-intake.mjs")]);
  assert.match(gitignore, /\/\.private-intake\//);
  assert.match(script, /sensitivityLevel: "confidential"/);
  assert.match(script, /viewAllowed: false/);
  assert.match(script, /internalAiAllowed: true/);
  assert.match(script, /externalAiAllowed: false/);
  assert.match(script, /redactionRequired: true/);
});

test("Ideas separate hourly market validation from editable fundamental validation", async () => {
  const [idea, market, store] = await Promise.all([
    read("deploy/edgeone-demo/src/idea-book.tsx"),
    read("app/market-validation.tsx"),
    read("public/cloud-functions/api/_edgeone-research-store.js"),
  ]);
  assert.match(idea, /Idea 股价验证/);
  assert.match(idea, /基本面证据 \/ 反向证据/);
  assert.match(idea, /validationNextCheck/);
  assert.match(market, /interval=1h/);
  assert.match(market, /最大 Upside/);
  assert.match(market, /最大 Downside/);
  assert.match(market, /60 \* 60 \* 1000/);
  assert.match(store, /fundamentalValidationNotes/);
  assert.match(store, /sealIdeaValidation/);
  assert.match(store, /validationSecret/);
  assert.match(store, /:validation/);
  assert.match(store, /upsideTargetPct/);
  assert.match(store, /downsideRiskPct/);
});
