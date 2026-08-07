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
  assert.match(store, /return record\.owner\?\.user_id === actor\.subject \|\| isManager\(actor, env\)/);
  assert.match(store, /item\.internalAiAllowed === true/);
  assert.match(store, /record\.internalAiAllowed !== false/);
  assert.match(store, /grayBoxExcerpt/);
  assert.match(store, /maxLength = 1800/);
  assert.doesNotMatch(store, /content: clean\(record\.content, 5000\)/);
  assert.match(store, /function managerEmails/);
  assert.match(store, /LEVEL_GRIND_OWNER_EMAIL/);
  assert.match(store, /LEVEL_GRIND_PRIMARY_PM_EMAIL/);
  assert.match(store, /LEVEL_GRIND_MEMBER_MANAGER_EMAILS/);
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

test("research classification keeps Public external and permits only internal reclassification", async () => {
  const [migration, service, fallback, notes, ideas] = await Promise.all([
    read("infra/tencent-postgres/005_three_level_classification.sql"),
    read("services/tencent-notes-api/server.mjs"),
    read("public/cloud-functions/api/_edgeone-research-store.js"),
    read("deploy/edgeone-demo/src/shared-notes.tsx"),
    read("deploy/edgeone-demo/src/idea-book.tsx"),
  ]);
  for (const source of [service, fallback, notes, ideas]) {
    assert.match(source, /public/);
    assert.match(source, /internal/);
    assert.match(source, /confidential/);
  }
  assert.doesNotMatch(notes, /option value="restricted"/);
  assert.doesNotMatch(ideas, /option value="restricted"/);
  assert.match(migration, /OLD\.sensitivity_level = 'public' AND NEW\.sensitivity_level <> 'public'/);
  assert.match(migration, /OLD\.sensitivity_level IN \('internal','confidential'\) AND NEW\.sensitivity_level = 'public'/);
  assert.match(service, /CLASSIFICATION_TRANSITION_FORBIDDEN/);
  assert.match(fallback, /Public 仅用于外源 benchmark/);
});

test("Ideas retain governed validation data while keeping the editor compact", async () => {
  const [idea, market, store] = await Promise.all([
    read("deploy/edgeone-demo/src/idea-book.tsx"),
    read("app/market-validation.tsx"),
    read("public/cloud-functions/api/_edgeone-research-store.js"),
  ]);
  assert.match(idea, /填写 ticker 后自动开始价格跟踪/);
  assert.doesNotMatch(idea, /FUNDAMENTAL VALIDATION|MARKET VALIDATION/);
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
