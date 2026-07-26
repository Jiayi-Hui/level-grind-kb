import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships the Level Grind context workspace instead of a starter", async () => {
  const [workspace, layout, page] = await Promise.all([
    readFile(new URL("../app/workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /Level Grind Context Infra/);
  assert.match(page, /<Workspace \/>/);
  assert.match(workspace, /Research inbox/);
  assert.match(workspace, /My context/);
  assert.match(workspace, /Team context/);
  assert.match(workspace, /Task context/);
  assert.match(workspace, /Conversation routing/);
  assert.match(workspace, /System boundary/);
  assert.doesNotMatch(workspace + layout + page, /Your site is taking shape|Building your site/);
});

test("keeps context boundaries and persistence explicit in source", async () => {
  const [workspace, documentsRoute, contextRoute, routingRoute, membersRoute, access, schema, readme] = await Promise.all([
    readFile(new URL("../app/workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/documents/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/context/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/routing/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/members/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/access.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);

  assert.match(workspace, /Personal context/);
  assert.match(workspace, /Team context/);
  assert.match(workspace, /Task context/);
  assert.match(workspace, /Conversation routing/);
  assert.match(workspace, /Manual routing active/);
  assert.match(workspace, /Company AVD/);
  assert.match(workspace, /Quant research/);
  assert.match(documentsRoute, /context_scope/);
  assert.match(documentsRoute, /visibility = 'team' OR d\.author_email/);
  assert.match(contextRoute, /personal_contexts/);
  assert.match(contextRoute, /task_contexts/);
  assert.match(routingRoute, /requireAppUser/);
  assert.match(routingRoute, /routing_policies/);
  assert.match(routingRoute, /conversation_workstreams/);
  assert.match(routingRoute, /WHERE owner_email = \?1/);
  assert.match(membersRoute, /Admin access required/);
  assert.match(membersRoute, /existing\?\.role === "owner"/);
  assert.match(access, /team_members/);
  assert.match(access, /LEVEL_GRIND_OWNER_EMAIL/);
  assert.match(access, /member\.status !== "active"/);
  assert.match(schema, /documentContext/);
  assert.match(schema, /personalContexts/);
  assert.match(schema, /taskContexts/);
  assert.match(schema, /routingPolicies/);
  assert.match(schema, /conversationWorkstreams/);
  assert.match(schema, /teamMembers/);
  assert.match(readme, /Raw data can remain/);
  assert.match(readme, /Automatic topic-shift detection requires/);
});

test("ships a real searchable report corpus and grounded assistant contract", async () => {
  const [workspace, corpusRoute, askRoute, corpusLib, schema] = await Promise.all([
    readFile(new URL("../app/workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/corpus/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/ask/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/corpus.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(workspace, /Report library/);
  assert.match(workspace, /Ask the reports/);
  assert.match(workspace, /Team AI usage/);
  assert.match(corpusRoute, /extractText/);
  assert.match(corpusRoute, /env\.FILES\.put/);
  assert.match(corpusRoute, /alreadyImported/);
  assert.match(askRoute, /AI_API_KEY/);
  assert.match(askRoute, /deepseek-v4-flash/);
  assert.match(askRoute, /Cite every material claim/);
  assert.match(askRoute, /ai_usage_events/);
  assert.match(corpusLib, /CREATE TABLE IF NOT EXISTS corpus_chunks/);
  assert.match(schema, /corpusDocuments/);
  assert.match(schema, /corpusChunks/);
  assert.match(schema, /aiUsageEvents/);
});
