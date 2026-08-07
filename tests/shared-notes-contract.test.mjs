import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shared Notes is a Clerk-authenticated TencentDB contract, not browser storage", async () => {
  const [api, ui, migration, service, attachments, attachmentResource] = await Promise.all([
    readFile(new URL("../public/cloud-functions/api/shared-notes.js", import.meta.url), "utf8"),
    readFile(new URL("../deploy/edgeone-demo/src/shared-notes.tsx", import.meta.url), "utf8"),
    readFile(new URL("../infra/tencent-postgres/001_notes_p0.sql", import.meta.url), "utf8"),
    readFile(new URL("../services/tencent-notes-api/server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../public/cloud-functions/api/shared-notes/[id]/attachments.js", import.meta.url), "utf8"),
    readFile(new URL("../public/cloud-functions/api/shared-notes/[id]/attachments/[attachmentId].js", import.meta.url), "utf8"),
  ]);

  assert.match(api, /await clerkIdentity\(request, env\)/);
  assert.match(api, /NOTES_SERVICE_BASE_URL/);
  assert.match(api, /Tencent service must independently validate the Clerk token/);
  assert.doesNotMatch(api, /supabaseRequest|SUPABASE_URL|mutate_team_note/);
  assert.doesNotMatch(ui, /localStorage|sessionStorage/);
  assert.match(ui, /request\("\/api\/shared-notes"/);
  assert.match(migration, /research_notes/);
  assert.match(migration, /research_audit_log/);
  assert.match(service, /verifyToken\(token/);
  assert.match(service, /TRUSTED_GATEWAY_REQUIRED/);
  assert.match(service, /timingSafeEqual/);
  assert.match(api, /X-Level-Grind-Service-Token/);
  assert.match(api, /X-Level-Grind-Email/);
  assert.match(service, /"research_notes"/);
  assert.match(service, /FOR UPDATE/);
  assert.match(service, /VERSION_CONFLICT/);
  assert.match(service, /pending_review/);
  assert.match(service, /approved/);
  assert.match(service, /ticker/);
  assert.match(service, /reconcileIdeaNotes/);
  assert.match(service, /templateFields/);
  assert.match(service, /viewAllowed/);
  assert.match(service, /externalAiAllowed/);
  assert.match(service, /redactionRequired/);
  assert.match(service, /canReadRaw\(actor, row\)/);
  assert.match(service, /team_gray_box_internal_ai/);
  assert.match(service, /research_private_search_index/);
  assert.match(service, /createHmac\("sha256", searchIndexKey\)/);
  assert.match(service, /\/v1\/internal\/askai\/private-research/);
  assert.match(service, /externalAiAllowed: row\.external_ai_allowed === true/);
  assert.match(service, /redactionRequired: row\.redaction_required === true/);
  assert.match(service, /NOTES_RETRIEVAL_SERVICE_TOKEN/);
  assert.match(service, /externalUse: "forbidden"/);
  assert.doesNotMatch(service, /agent-chat\.js/);
  assert.match(service, /IDEA_NOTE_NOT_FOUND/);
  assert.match(migration, /ticker text NOT NULL/);
  assert.match(migration, /pending_review/);
  assert.match(migration, /approved/);
  assert.match(service, /deleted_at\s*=\s*now\(\)/);
  assert.match(service, /INSERT INTO research_audit_log/);
  assert.doesNotMatch(service, /SUPABASE|supabase/i);
  assert.match(api, /CONTROL_BODY_JSON_REQUIRED/);
  assert.match(api, /ATTACHMENT_SERVICE_UNAVAILABLE/);
  assert.doesNotMatch(api, /request\.arrayBuffer\(\)/);
  assert.match(attachments, /attachments/);
  assert.match(attachmentResource, /attachmentId/);
});
