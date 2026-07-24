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
  assert.match(workspace, /System boundary/);
  assert.doesNotMatch(workspace + layout + page, /Your site is taking shape|Building your site/);
});

test("keeps context boundaries and persistence explicit in source", async () => {
  const [workspace, documentsRoute, contextRoute, schema, readme] = await Promise.all([
    readFile(new URL("../app/workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/documents/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/context/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);

  assert.match(workspace, /Personal context/);
  assert.match(workspace, /Team context/);
  assert.match(workspace, /Task context/);
  assert.match(workspace, /Company AVD/);
  assert.match(workspace, /Quant research/);
  assert.match(documentsRoute, /context_scope/);
  assert.match(documentsRoute, /visibility = 'team' OR d\.author_email/);
  assert.match(contextRoute, /personal_contexts/);
  assert.match(contextRoute, /task_contexts/);
  assert.match(schema, /documentContext/);
  assert.match(schema, /personalContexts/);
  assert.match(schema, /taskContexts/);
  assert.match(readme, /Raw data can remain/);
});
