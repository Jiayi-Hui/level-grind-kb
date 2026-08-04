import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { attachmentObjectKey, createObjectStore } from "../services/tencent-notes-api/object-store.mjs";

test("local object adapter is test-only and keeps bytes outside PostgreSQL", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "level-grind-attachments-"));
  try {
    const store = createObjectStore({ NODE_ENV: "test", NOTES_OBJECT_STORE_DRIVER: "local", NOTES_LOCAL_OBJECT_STORE_DIR: root });
    const key = attachmentObjectKey("level-grind", "idea", "00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002", "memo.md");
    await store.put(key, Buffer.from("private attachment"));
    assert.equal((await store.get(key)).toString(), "private attachment");
    await store.remove(key);
    assert.equal(createObjectStore({ NODE_ENV: "production", NOTES_OBJECT_STORE_DRIVER: "local", NOTES_LOCAL_OBJECT_STORE_DIR: root }).configured, false);
    assert.equal(createObjectStore({ NODE_ENV: "production", NOTES_OBJECT_STORE_DRIVER: "cos" }).configured, false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("attachment API is encrypted, versioned, audited, and uses COS presigned direct upload", async () => {
  const [service, migration, store, dockerfile] = await Promise.all([
    readFile(new URL("../services/tencent-notes-api/server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../infra/tencent-postgres/002_note_idea_attachments.sql", import.meta.url), "utf8"),
    readFile(new URL("../services/tencent-notes-api/object-store.mjs", import.meta.url), "utf8"),
    readFile(new URL("../services/tencent-notes-api/Dockerfile", import.meta.url), "utf8"),
  ]);
  for (const endpoint of ["attachments", "complete", "status", "retry"]) assert.match(service, new RegExp(endpoint));
  assert.match(service, /attachmentTarget\(client, type, targetId, actor/);
  assert.match(service, /encryptText\(document\.text/);
  assert.match(service, /attachmentTarget\(client, type, targetId, actor, false, false\)/);
  assert.match(service, /extraction: \{ status: parseStatus/);
  assert.match(service, /ATTACHMENT_CONTENT_MISMATCH/);
  assert.match(service, /OBJECT_STORE_NOT_CONFIGURED/);
  assert.match(service, /soft_delete/);
  assert.match(migration, /research_attachments/);
  assert.match(migration, /research_attachment_extractions/);
  assert.match(migration, /research_attachment_jobs/);
  assert.match(migration, /deleted_at/);
  assert.match(migration, /version integer/);
  assert.match(store, /getObjectUrl/);
  assert.match(store, /x-cos-meta-sha256/);
  assert.match(store, /headObject/);
  assert.match(dockerfile, /COPY services\/tencent-notes-api\/object-store\.mjs/);
  assert.doesNotMatch(service, /COS_SECRET_KEY.*send\(/);
});
