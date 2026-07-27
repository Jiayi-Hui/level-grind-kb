import assert from "node:assert/strict";
import { strFromU8, unzipSync } from "fflate";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships the bilingual Research OS instead of the legacy context navigation", async () => {
  const [workspace, i18n, layout, page] = await Promise.all([
    readFile(new URL("../app/research-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /Level Grind Research OS/);
  assert.match(page, /<ResearchWorkspace \/>/);
  assert.match(i18n, /My knowledge/);
  assert.match(i18n, /个人知识库/);
  assert.match(i18n, /Report library/);
  assert.match(i18n, /研究问答/);
  assert.match(i18n, /Welcome back/);
  assert.match(workspace, /language-switch/);
  assert.doesNotMatch(workspace, /"assistant" \| "history"/);
  assert.doesNotMatch(workspace, /Conversation routing|routingComposer|Task context/);
  assert.doesNotMatch(workspace + layout + page, /Your site is taking shape|Building your site/);
});

test("persists preferences, private history, storage visibility, and governed access", async () => {
  const [workspace, preferencesRoute, askRoute, membersRoute, access, research, schema] = await Promise.all([
    readFile(new URL("../app/research-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/preferences/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/ask/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/members/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/access.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/research.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(workspace, /storage-meter/);
  assert.match(workspace, /lg-obsidian-vault/);
  assert.match(workspace, /URLSearchParams/);
  assert.match(workspace, /askingSeconds/);
  assert.match(workspace, /report-card-progress/);
  assert.doesNotMatch(workspace, /vaultName\.trim\(\) \|\| "Research"/);
  assert.match(workspace, /answerMarkdown/);
  assert.match(preferencesRoute, /remainingBytes/);
  assert.match(preferencesRoute, /sharedCorpusBytes/);
  assert.match(askRoute, /WHERE user_email = \?1/);
  assert.match(askRoute, /INSERT INTO research_queries/);
  assert.match(membersRoute, /Admin access required/);
  assert.match(membersRoute, /"analyst", "pm", "gem_pm"/);
  assert.match(access, /team_members/);
  assert.match(access, /LEVEL_GRIND_OWNER_EMAIL/);
  assert.match(research, /CREATE TABLE IF NOT EXISTS user_preferences/);
  assert.match(research, /CREATE TABLE IF NOT EXISTS research_queries/);
  assert.match(schema, /userPreferences/);
  assert.match(schema, /researchQueries/);
});

test("ships bounded research chats, project rename, multidimensional filters, and model operations", async () => {
  const [workspace, css, sessions, models, modelMigration, modelTemplate, simpleModel, modelWorkbench] = await Promise.all([
    readFile(new URL("../app/research-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/research-sessions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/models/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0012_model_workbench.sql", import.meta.url), "utf8"),
    readFile(new URL("../public/level-grind-model-template.xlsx", import.meta.url)),
    readFile(new URL("../public/Simple_Valuation_Model_Demo.xlsx", import.meta.url)),
    readFile(new URL("../app/model-workbench.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(css, /height: min\(980px, calc\(100dvh - 160px\)\)/);
  assert.match(css, /\.chat-thread \{ min-height: 0/);
  assert.match(workspace, /renameProject/);
  assert.match(sessions, /export async function PATCH/);
  assert.match(workspace, /eventDimension/);
  assert.match(workspace, /reportCompanyFilter/);
  assert.match(workspace, /globalSearchResults/);
  assert.match(workspace, /<ModelWorkbench/);
  assert.match(models, /scan-updates/);
  assert.match(models, /accept-update/);
  assert.match(modelMigration, /CREATE TABLE IF NOT EXISTS model_workbooks/);
  assert.match(modelMigration, /CREATE TABLE IF NOT EXISTS model_update_queue/);
  assert.equal(modelTemplate.subarray(0, 2).toString(), "PK");
  assert.equal(simpleModel.subarray(0, 2).toString(), "PK");
  const simpleModelXml = Object.entries(unzipSync(simpleModel))
    .filter(([name]) => name.endsWith(".xml"))
    .map(([, bytes]) => strFromU8(bytes))
    .join("\n");
  assert.match(simpleModelXml, /name="Inputs"/);
  assert.match(simpleModelXml, /name="Calculations"/);
  assert.match(simpleModelXml, /name="Outputs"/);
  assert.match(simpleModelXml, /revenue_2026/);
  assert.match(simpleModelXml, /implied_share_price/);
  assert.match(modelWorkbench, /const formElement = event\.currentTarget/);
  assert.match(modelWorkbench, /formElement\.reset\(\)/);
  assert.match(modelWorkbench, /Simple_Valuation_Model_Demo\.xlsx/);
});

test("ships the selected logo and dynamically estimated provider usage", async () => {
  const [layout, workspace, manifest, logo, corpusRoute, research] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/research-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/level-grind-logo.png", import.meta.url)),
    readFile(new URL("../app/api/corpus/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/research.ts", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /level-grind-logo\.png/);
  assert.match(manifest, /level-grind-logo\.png/);
  assert.equal(logo.subarray(1, 4).toString(), "PNG");
  assert.match(workspace, /DeepSeek 用量估算/);
  assert.match(workspace, /estimatedDeepSeekBalance/);
  assert.match(workspace, /trackedDeepSeekTokens/);
  assert.match(workspace, /trackedTavilySearches/);
  assert.match(workspace, /1,000 credits/);
  assert.doesNotMatch(workspace, /手动同步|控制台快照|manual sync|console snapshot/);
  assert.match(workspace, /Pay-as-you-go off/);
  assert.match(corpusRoute, /web_search_credits/);
  assert.match(research, /CREATE TABLE IF NOT EXISTS web_usage_events/);
  assert.match(research, /credits_estimated/);
});

test("ships report, web, and hybrid evidence with safe Markdown rendering", async () => {
  const [workspace, markdown, corpusRoute, corpusImport, askRoute, research, corpusLib, schema] = await Promise.all([
    readFile(new URL("../app/research-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/markdown-answer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/corpus/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/corpus-import.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/ask/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/research.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/corpus.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(workspace, /modeReports/);
  assert.match(workspace, /modeWeb/);
  assert.match(workspace, /modeHybrid/);
  assert.match(workspace, /window\.open\("", "_blank"\)/);
  assert.match(workspace, /authorizedFetch\(`\/api\/corpus\/files/);
  assert.match(markdown, /inlineMarkdown/);
  assert.match(markdown, /<strong/);
  assert.match(corpusImport, /extractText/);
  assert.match(corpusImport, /env\.FILES\.put/);
  assert.match(corpusRoute, /alreadyImported/);
  assert.match(askRoute, /AI_API_KEY/);
  assert.match(askRoute, /deepseek-v4-flash/);
  assert.match(askRoute, /cite every material claim/i);
  assert.match(askRoute, /webSearch\(question, user\.email\)/);
  assert.match(research, /WEB_SEARCH_API_KEY/);
  assert.match(research, /api\.tavily\.com\/search/);
  assert.match(corpusLib, /CREATE TABLE IF NOT EXISTS corpus_chunks/);
  assert.match(schema, /corpusDocuments/);
  assert.match(schema, /aiUsageEvents/);
});

test("merges personal and team knowledge entries and lets owners manage them", async () => {
  const workspace = await readFile(new URL("../app/research-workspace.tsx", import.meta.url), "utf8");
  const documentsApi = await readFile(new URL("../app/api/documents/route.ts", import.meta.url), "utf8");

  assert.match(documentsApi, /type ContextScope = "personal" \| "team" \| "personal\+team"/);
  assert.match(documentsApi, /function mergeDuplicateRows/);
  assert.match(documentsApi, /duplicate_ids/);
  assert.match(documentsApi, /export async function PATCH/);
  assert.match(documentsApi, /export async function DELETE/);
  assert.match(documentsApi, /record\.author_email === user\.email \|\| user\.role === "owner" \|\| user\.role === "admin"/);

  assert.match(workspace, /个人 \+ 团队/);
  assert.match(workspace, /doc\.context_scope\.split\("\+"\)/);
  assert.match(workspace, /duplicateIds/);
  assert.match(workspace, /onEdit\(selected\)/);
  assert.match(workspace, /onDelete\(selected\)/);
});
