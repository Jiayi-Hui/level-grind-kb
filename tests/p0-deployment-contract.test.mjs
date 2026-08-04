import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P0 documents preserve Clerk identity and a frozen, Tencent-only Notes path", async () => {
  const [architecture, qa, gateway, ui] = await Promise.all([
    readFile(new URL("../.project-director/p0-architecture.md", import.meta.url), "utf8"),
    readFile(new URL("../.project-director/p0-deployment-qa.md", import.meta.url), "utf8"),
    readFile(new URL("../public/cloud-functions/api/shared-notes.js", import.meta.url), "utf8"),
    readFile(new URL("../deploy/edgeone-demo/src/shared-notes.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(architecture, /same Clerk instance, user IDs/i);
  assert.match(architecture, /No member re-invites/i);
  assert.match(qa, /Production upload is \*\*frozen by default\*\*/);
  assert.match(qa, /AES-256-GCM/);
  assert.match(qa, /KMS is not a\s+runtime dependency/i);
  assert.match(gateway, /NOTES_SERVICE_BASE_URL/);
  assert.doesNotMatch(gateway, /supabaseRequest|SUPABASE_URL|D1|R2/i);
  assert.doesNotMatch(ui, /localStorage|sessionStorage/);
});
