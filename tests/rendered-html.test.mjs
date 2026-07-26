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
  assert.match(i18n, /Research inbox/);
  assert.match(i18n, /研究收件箱/);
  assert.match(i18n, /Report library/);
  assert.match(i18n, /问答历史/);
  assert.match(i18n, /Welcome back/);
  assert.match(workspace, /language-switch/);
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
  assert.match(workspace, /answerMarkdown/);
  assert.match(preferencesRoute, /remainingBytes/);
  assert.match(preferencesRoute, /sharedCorpusBytes/);
  assert.match(askRoute, /WHERE user_email = \?1/);
  assert.match(askRoute, /INSERT INTO research_queries/);
  assert.match(membersRoute, /Admin access required/);
  assert.match(access, /team_members/);
  assert.match(access, /LEVEL_GRIND_OWNER_EMAIL/);
  assert.match(research, /CREATE TABLE IF NOT EXISTS user_preferences/);
  assert.match(research, /CREATE TABLE IF NOT EXISTS research_queries/);
  assert.match(schema, /userPreferences/);
  assert.match(schema, /researchQueries/);
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
  assert.match(workspace, /window\.open\(`\/api\/corpus\/files/);
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
