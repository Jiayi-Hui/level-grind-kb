import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("source contributor attribution preserves uploader, source, and legacy records", async () => {
  const [migration, migrator, service] = await Promise.all([
    read("infra/tencent-postgres/006_source_contributor.sql"),
    read("services/tencent-notes-api/scripts/migrate.mjs"),
    read("services/tencent-notes-api/server.mjs"),
  ]);
  for (const table of ["research_notes", "research_ideas"]) assert.match(migration, new RegExp(`ALTER TABLE ${table}`));
  assert.match(migration, /source_contributor_user_id uuid REFERENCES research_users\(id\)/);
  assert.match(migration, /created_by_user_id uuid REFERENCES research_users\(id\)/);
  assert.match(migration, /COALESCE\(source_contributor_user_id, owner_user_id\)/);
  assert.match(migration, /COALESCE\(created_by_user_id, owner_user_id\)/);
  assert.match(migration, /ALTER COLUMN source_contributor_user_id SET NOT NULL/);
  assert.match(migration, /ALTER COLUMN created_by_user_id SET NOT NULL/);
  assert.match(migrator, /006_source_contributor\.sql/);
  assert.match(service, /source_contributor_user_id,created_by_user_id/);
  assert.match(service, /sourceContributorUserId:source\.id/);
  assert.match(service, /createdBy:/);
  assert.match(service, /sourceContributor:/);
});

test("manager delegation and raw-read boundaries are explicit in both backends", async () => {
  const [service, fallback, gateway] = await Promise.all([
    read("services/tencent-notes-api/server.mjs"),
    read("public/cloud-functions/api/_edgeone-research-store.js"),
    read("public/cloud-functions/api/shared-notes.js"),
  ]);
  assert.match(service, /function canReadRaw\(actor, row\).*source_contributor_user_id === actor\.id/s);
  assert.match(service, /function roleCanEdit\(actor, row\).*owner_user_id === actor\.id/s);
  assert.match(service, /SOURCE_CONTRIBUTOR_MANAGER_ONLY/);
  assert.match(service, /SOURCE_CONTRIBUTOR_NOT_ACTIVE/);
  assert.match(service, /JOIN research_team_memberships m/);
  assert.match(service, /m\.status='active'/);
  assert.match(service, /SOURCE_CONTRIBUTOR_IMMUTABLE/);
  assert.match(fallback, /record\.sourceContributor\?\.email/);
  assert.match(fallback, /function memberEmails/);
  assert.match(fallback, /LEVEL_GRIND_INVITED_EMAILS/);
  assert.match(fallback, /SOURCE_CONTRIBUTOR_MANAGER_ONLY/);
  assert.match(gateway, /SOURCE_CONTRIBUTOR_MANAGER_ONLY/);
  assert.match(gateway, /SOURCE_CONTRIBUTOR_NOT_ACTIVE/);
});
