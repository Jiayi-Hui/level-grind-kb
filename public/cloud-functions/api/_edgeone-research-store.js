import { getStore } from "@edgeone/pages-blob";
import { clerkIdentity } from "./_shared-auth.js";

const records = getStore({ name: "level-grind-research", consistency: "strong" });
const files = getStore({ name: "level-grind-files", consistency: "strong" });
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
const clean = (value, limit = 20_000) => String(value || "").replace(/\u0000/g, "").trim().slice(0, limit);
const recordKey = (resource, id) => `${resource}/${id}.json`;
const attachmentKey = (id) => `attachments/${id}.json`;
const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value) => Uint8Array.from(atob(value), (part) => part.charCodeAt(0));

async function masterKey(env) {
  const raw = fromBase64(String(env.NOTES_MASTER_KEY_B64 || ""));
  if (raw.byteLength !== 32) throw new Error("RESEARCH_ENCRYPTION_NOT_CONFIGURED");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function seal(value, env, aad) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(aad) }, await masterKey(env), encoder.encode(value)));
  return { v: 1, iv: toBase64(iv), ciphertext: toBase64(ciphertext) };
}
async function open(secret, env, aad) {
  if (!secret) return "";
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(secret.iv), additionalData: encoder.encode(aad) }, await masterKey(env), fromBase64(secret.ciphertext));
  return decoder.decode(plaintext);
}
async function input(request) { return ["GET", "HEAD"].includes(request.method) ? {} : request.json().catch(() => { throw new Error("INVALID_JSON"); }); }
async function getRecord(resource, id) { return records.get(recordKey(resource, id), { type: "json", consistency: "strong" }); }
async function clientRecord(record, env) {
  const secretField = record.resource === "notes" ? "bodySecret" : "thesisSecret";
  const plainField = record.resource === "notes" ? "body" : "thesis";
  const result = { ...record, [plainField]: await open(record[secretField], env, `${record.resource}:${record.id}`) };
  delete result[secretField]; return result;
}
async function listRecords(resource, env) {
  const listing = await records.list({ prefix: `${resource}/`, consistency: "strong", limit: 500 });
  const stored = await Promise.all(listing.blobs.map(({ key }) => records.get(key, { type: "json", consistency: "strong" })));
  const expanded = await Promise.all(stored.filter((item) => item && !item.deletedAt).map((item) => clientRecord(item, env)));
  return expanded.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
function notePayload(value) { return { title: clean(value.title, 500), sourceKind: clean(value.sourceKind || "manual_note", 100), sensitivityLevel: ["public", "internal", "confidential", "restricted"].includes(value.sensitivityLevel) ? value.sensitivityLevel : "internal", aiProcessingAllowed: Boolean(value.aiProcessingAllowed), externalSearchAllowed: Boolean(value.externalSearchAllowed), downloadAllowed: Boolean(value.downloadAllowed), body: clean(value.body, 200_000) }; }
function ideaPayload(value) { return { title: clean(value.title, 500), ticker: clean(value.ticker, 120), thesis: clean(value.thesis, 200_000), status: ["draft", "review", "approved", "rejected", "archived"].includes(value.status) ? value.status : "draft", direction: ["long", "short", "watch"].includes(value.direction) ? value.direction : "watch", noteIds: Array.isArray(value.noteIds) ? value.noteIds.map((id) => clean(id, 80)).filter(Boolean).slice(0, 100) : [] }; }
async function createRecord(resource, value, actor, env) {
  const payload = resource === "notes" ? notePayload(value) : ideaPayload(value); if (!payload.title) return response({ error: "标题不能为空。" }, 400);
  const id = crypto.randomUUID(); const now = new Date().toISOString(); const secretField = resource === "notes" ? "bodySecret" : "thesisSecret"; const plainField = resource === "notes" ? "body" : "thesis";
  const record = { ...payload, resource, id, [secretField]: await seal(payload[plainField], env, `${resource}:${id}`), [plainField]: undefined, version: 1, createdAt: now, updatedAt: now, owner: { user_id: actor.subject, email: actor.email, display_name: actor.name } };
  await records.setJSON(recordKey(resource, id), record, { onlyIfNew: true, cacheControl: "no-store" });
  return response({ [resource === "notes" ? "note" : "idea"]: await clientRecord(record, env), configured: true, ingestionFrozen: false }, 201);
}
async function mutateRecord(resource, id, request, env, actor) {
  const current = await getRecord(resource, id); if (!current || current.deletedAt) return response({ error: "记录不存在。" }, 404); const value = await input(request);
  if (Number(value.expectedVersion) !== Number(current.version)) return response({ error: "版本冲突，请刷新后重试。", currentVersion: current.version }, 409);
  if (request.method === "DELETE") { const updated = { ...current, deletedAt: new Date().toISOString(), deletedBy: actor.subject, version: current.version + 1, updatedAt: new Date().toISOString() }; await records.setJSON(recordKey(resource, id), updated, { cacheControl: "no-store" }); return response({ ok: true }); }
  const payload = resource === "notes" ? notePayload(value) : ideaPayload(value); if (!payload.title) return response({ error: "标题不能为空。" }, 400);
  const secretField = resource === "notes" ? "bodySecret" : "thesisSecret"; const plainField = resource === "notes" ? "body" : "thesis";
  const updated = { ...current, ...payload, [secretField]: await seal(payload[plainField], env, `${resource}:${id}`), [plainField]: undefined, version: current.version + 1, updatedAt: new Date().toISOString(), updatedBy: actor.subject };
  await records.setJSON(recordKey(resource, id), updated, { cacheControl: "no-store" }); return response({ [resource === "notes" ? "note" : "idea"]: await clientRecord(updated, env), configured: true, ingestionFrozen: false });
}
async function listAttachments(resource, parentId) {
  const listing = await records.list({ prefix: "attachments/", consistency: "strong", limit: 500 }); const stored = await Promise.all(listing.blobs.map(({ key }) => records.get(key, { type: "json", consistency: "strong" })));
  return stored.filter((item) => item && !item.deletedAt && item.targetId === parentId && item.targetType === (resource === "notes" ? "note" : "idea")).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
async function initAttachment(resource, parentId, value, actor) {
  const parent = await getRecord(resource, parentId); if (!parent || parent.deletedAt) return response({ error: "父记录不存在。" }, 404);
  const fileName = clean(value.fileName, 300); const mediaType = clean(value.mediaType || "application/octet-stream", 160); const byteSize = Number(value.byteSize); const sha256 = clean(value.sha256, 64).toLowerCase();
  if (!fileName || !Number.isFinite(byteSize) || byteSize <= 0 || byteSize > 25 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(sha256)) return response({ error: "附件信息不完整或文件超过 25 MB。" }, 400);
  const id = crypto.randomUUID(); const now = new Date().toISOString(); const objectKey = `team/${resource}/${parentId}/${id}/${fileName.replace(/[^a-zA-Z0-9._-]+/g, "_")}`;
  const attachment = { id, targetType: resource === "notes" ? "note" : "idea", targetId: parentId, fileName, mediaType, byteSize, sha256, objectKey, uploadStatus: "initialized", parseStatus: "queued", version: 1, createdAt: now, updatedAt: now, owner: { user_id: actor.subject, email: actor.email, display_name: actor.name } };
  await records.setJSON(attachmentKey(id), attachment, { onlyIfNew: true, cacheControl: "no-store" }); const signed = await files.createUploadUrl(objectKey, { expireSeconds: 900, contentType: mediaType });
  return response({ attachment, upload: { url: signed.url, method: "PUT", headers: { "Content-Type": mediaType }, expiresAt: signed.expiresAt } }, 201);
}
async function handleAttachment(resource, suffix, request, actor) {
  const parent = suffix.match(/^\/([^/]+)\/attachments$/);
  if (parent) { if (request.method === "GET") return response({ attachments: await listAttachments(resource, parent[1]), configured: true, ingestionFrozen: false }); if (request.method === "POST") return initAttachment(resource, parent[1], await input(request), actor); }
  const item = suffix.match(/^\/([^/]+)(?:\/(complete|retry))?$/); if (!item) return response({ error: "附件路径无效。" }, 404);
  const id = item[1]; const action = item[2] || "status"; const attachment = await records.get(attachmentKey(id), { type: "json", consistency: "strong" }); if (!attachment || attachment.deletedAt) return response({ error: "附件不存在。" }, 404);
  if (request.method === "GET" && action === "status") return response({ attachment });
  if (request.method === "DELETE" && action === "status") { const value = await input(request); if (Number(value.expectedVersion) !== attachment.version) return response({ error: "版本冲突，请刷新后重试。" }, 409); const updated = { ...attachment, deletedAt: new Date().toISOString(), deletedBy: actor.subject, version: attachment.version + 1, updatedAt: new Date().toISOString() }; await records.setJSON(attachmentKey(id), updated, { cacheControl: "no-store" }); return response({ ok: true }); }
  if (request.method === "POST" && action === "complete") { const metadata = await files.getMetadata(attachment.objectKey, { consistency: "strong" }); if (!metadata) return response({ error: "文件尚未完成直传。" }, 409); const updated = { ...attachment, uploadStatus: "uploaded", parseStatus: "needs_review", parseErrorCode: "PARSING_DEFERRED", version: attachment.version + 1, updatedAt: new Date().toISOString() }; await records.setJSON(attachmentKey(id), updated, { cacheControl: "no-store" }); return response({ attachment: updated }); }
  if (request.method === "POST" && action === "retry") return response({ error: "正文解析将在后端任务上线后开放；原文件已经保存。", code: "PARSING_DEFERRED" }, 501);
  return response({ error: "不支持的附件操作。" }, 405);
}

export async function nativeResearchRequest(request, env, { resource = "notes", suffix = "" } = {}) {
  const actor = await clerkIdentity(request, env);
  if (resource === "attachments") return handleAttachment("notes", suffix, request, actor);
  if (/\/attachments(?:\/|$)/.test(suffix)) return handleAttachment(resource, suffix, request, actor);
  const id = suffix.match(/^\/([^/]+)$/)?.[1];
  if (!id) { if (request.method === "GET") return response({ [resource]: await listRecords(resource, env), configured: true, ingestionFrozen: false, storage: "tencent-edgeone-blob" }); if (request.method === "POST") return createRecord(resource, await input(request), actor, env); return response({ error: "不支持的请求。" }, 405); }
  if (request.method === "GET") { const record = await getRecord(resource, id); return record && !record.deletedAt ? response({ [resource === "notes" ? "note" : "idea"]: await clientRecord(record, env), configured: true, ingestionFrozen: false }) : response({ error: "记录不存在。" }, 404); }
  if (["PATCH", "DELETE"].includes(request.method)) return mutateRecord(resource, id, request, env, actor);
  return response({ error: "不支持的请求。" }, 405);
}
