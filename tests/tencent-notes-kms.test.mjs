import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createTestCryptoContext, decryptText, encryptText, loadCryptoContext } from "../services/tencent-notes-api/crypto-envelope.mjs";

test("AES-GCM envelope encrypts a record without preserving plaintext and binds its AAD", () => {
  const previous = process.env.NODE_ENV; process.env.NODE_ENV = "test";
  const context = createTestCryptoContext("test-only-secret");
  const binding = { teamId: "level-grind", recordType: "note", recordId: "00000000-0000-4000-8000-000000000001" };
  const encrypted = encryptText("敏感投研正文", context, binding);
  assert.notEqual(encrypted.ciphertext_b64, "敏感投研正文");
  assert.equal(decryptText(encrypted, context, binding), "敏感投研正文");
  assert.throws(() => decryptText(encrypted, context, { ...binding, recordId: "00000000-0000-4000-8000-000000000002" }));
  process.env.NODE_ENV = previous;
});

test("key ring keeps prior encrypted records readable during a staged rotation", () => {
  const oldKey = Buffer.alloc(32, 7).toString("base64");
  const newKey = Buffer.alloc(32, 9).toString("base64");
  const binding = { teamId: "level-grind", recordType: "idea", recordId: "00000000-0000-4000-8000-000000000003" };
  const oldContext = loadCryptoContext({ NOTES_MASTER_KEYS_JSON: JSON.stringify({ 1: oldKey }), NOTES_ACTIVE_KEY_VERSION: "1" });
  const priorRecord = encryptText("original thesis", oldContext, binding);
  const rotatingContext = loadCryptoContext({ NOTES_MASTER_KEYS_JSON: JSON.stringify({ 1: oldKey, 2: newKey }), NOTES_ACTIVE_KEY_VERSION: "2" });
  assert.equal(decryptText(priorRecord, rotatingContext, binding), "original thesis");
  const newRecord = encryptText("new thesis", rotatingContext, binding);
  assert.equal(newRecord.key_version, 2);
  assert.equal(decryptText(newRecord, rotatingContext, binding), "new thesis");
  assert.throws(() => decryptText(priorRecord, loadCryptoContext({ NOTES_MASTER_KEYS_JSON: JSON.stringify({ 2: newKey }), NOTES_ACTIVE_KEY_VERSION: "2" }), binding), /NOTES_ENCRYPTION_VERSION_UNSUPPORTED/);
});

test("production encryption and audit contracts fail closed and omit research body", async () => {
  assert.throws(() => loadCryptoContext({ NODE_ENV: "production" }), /NOTES_ENCRYPTION_NOT_CONFIGURED/);
  const [migration, service] = await Promise.all([
    readFile(new URL("../infra/tencent-postgres/001_notes_p0.sql", import.meta.url), "utf8"),
    readFile(new URL("../services/tencent-notes-api/server.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /body_ciphertext_b64/);
  assert.match(migration, /thesis_ciphertext_b64/);
  assert.match(migration, /research_audit_log/);
  assert.match(migration, /research_audit_log_immutable/);
  assert.doesNotMatch(migration, /body_markdown/);
  assert.match(migration, /sensitivity_level/);
  assert.match(migration, /ai_processing_allowed/);
  assert.match(migration, /external_search_allowed/);
  assert.match(migration, /download_allowed/);
  assert.match(service, /loadCryptoContext\(\)/);
  assert.match(service, /async function audit/);
  assert.doesNotMatch(service, /createKmsProvider|TENCENT_KMS|KMS_PROVIDER/);
  assert.doesNotMatch(service, /console\.log\(.*body/);
});
