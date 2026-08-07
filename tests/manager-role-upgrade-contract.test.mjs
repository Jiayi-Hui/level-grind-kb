import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, root), "utf8"); }

test("configured owner and manager identities receive additive membership roles", async () => {
  const server = await source("services/tencent-notes-api/server.mjs");

  assert.match(server, /LEVEL_GRIND_MANAGER_EMAILS/);
  assert.match(server, /function configuredMembershipRole\(email\)/);
  assert.match(server, /ownerEmails\.has\(email\).*return "Owner"/s);
  assert.match(server, /managerEmails\.has\(email\).*return "PM"/s);
  assert.match(server, /configuredRole === "Owner" && currentRole !== "Owner"/);
  assert.match(server, /configuredRole === "PM" && currentRole === "Analyst"/);
  assert.match(server, /membership\.status === "active"/);
  assert.match(server, /UPDATE research_team_memberships SET role=\$3,updated_at=now\(\)/);
  assert.doesNotMatch(server, /SET role='Analyst'/);
});

test("role refresh preserves the existing Clerk identity and does not create an invite flow", async () => {
  const server = await source("services/tencent-notes-api/server.mjs");

  assert.match(server, /ON CONFLICT \(clerk_user_id\) DO UPDATE/);
  assert.match(server, /SELECT \* FROM research_team_memberships WHERE team_id=\$1 AND user_id=\$2 FOR UPDATE/);
  assert.doesNotMatch(server, /clerk\.invitations|createInvitation|invitations\.create/);
});

test("EdgeOne raw-view and member-management checks recognize the canonical manager list", async () => {
  const [fallback, invitations, deployment] = await Promise.all([
    source("public/cloud-functions/api/_edgeone-research-store.js"),
    source("public/cloud-functions/api/invitations.js"),
    source("services/tencent-notes-api/DEPLOYMENT_CHECKLIST.md"),
  ]);

  assert.match(fallback, /LEVEL_GRIND_MANAGER_EMAILS/);
  assert.match(invitations, /LEVEL_GRIND_MANAGER_EMAILS/);
  assert.match(deployment, /Additive role refresh, without re-inviting anyone/);
  assert.match(deployment, /changes a session/);
});
