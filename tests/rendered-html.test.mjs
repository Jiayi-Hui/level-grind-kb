import assert from "node:assert/strict";
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
  const [workspace, css, sessions, models, modelMigration, modelTemplate] = await Promise.all([
    readFile(new URL("../app/research-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/research-sessions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/models/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0012_model_workbench.sql", import.meta.url), "utf8"),
    readFile(new URL("../public/level-grind-model-template.xlsx", import.meta.url)),
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
});

test("ships the selected logo and honest provider quota snapshots", async () => {
  const [layout, workspace, manifest, logo] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/research-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/level-grind-logo.png", import.meta.url)),
  ]);
  assert.match(layout, /level-grind-logo\.png/);
  assert.match(manifest, /level-grind-logo\.png/);
  assert.equal(logo.subarray(1, 4).toString(), "PNG");
  assert.match(workspace, /DeepSeek 控制台快照/);
  assert.match(workspace, /¥99\.78/);
  assert.match(workspace, /16,469/);
  assert.match(workspace, /1,000 credits/);
  assert.match(workspace, /手动同步/);
  assert.match(workspace, /Pay-as-you-go off/);
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
  assert.match(askRoute, /webSearch\(question\)/);
  assert.match(research, /WEB_SEARCH_API_KEY/);
  assert.match(research, /api\.tavily\.com\/search/);
  assert.match(corpusLib, /CREATE TABLE IF NOT EXISTS corpus_chunks/);
  assert.match(schema, /corpusDocuments/);
  assert.match(schema, /aiUsageEvents/);
});
