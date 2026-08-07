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
  const owner = record.owner || {};
  const result = {
    ...record,
    sourceContributor: record.sourceContributor || owner,
    createdBy: record.createdBy || owner,
    sensitivityLevel: record.sensitivityLevel === "restricted" ? "confidential" : record.sensitivityLevel,
    [plainField]: await open(record[secretField], env, `${record.resource}:${record.id}`),
  };
  if (record.resource === "ideas" && record.validationSecret) {
    const validation = JSON.parse(await open(record.validationSecret, env, `${record.resource}:${record.id}:validation`) || "{}");
    result.templateFields = { ...result.templateFields, ...validation };
  }
  delete result[secretField]; delete result.validationSecret; return result;
}
function managerEmails(env) {
  return new Set([
    env.LEVEL_GRIND_OWNER_EMAIL,
    env.LEVEL_GRIND_MANAGER_EMAILS,
    env.LEVEL_GRIND_PRIMARY_PM_EMAIL,
    ...String(env.LEVEL_GRIND_MEMBER_MANAGER_EMAILS || "").split(","),
  ].map((email) => String(email || "").trim().toLowerCase()).filter(Boolean));
}
function canView(record, actor, env) {
  // Contributors see their own raw research. Explicitly configured managers
  // can review the team corpus; ordinary members never receive another
  // contributor's decrypted record or attachment list.
  return record.owner?.user_id === actor.subject
    || String(record.sourceContributor?.email || record.owner?.email || "").toLowerCase() === String(actor.email || "").toLowerCase()
    || isManager(actor, env);
}
function isManager(actor, env) {
  return managerEmails(env).has(String(actor.email || "").trim().toLowerCase());
}
function canEdit(record, actor, env) {
  return record.owner?.user_id === actor.subject || isManager(actor, env);
}
function memberEmails(env) {
  return new Set([
    ...managerEmails(env),
    ...String(env.LEVEL_GRIND_INVITED_EMAILS || "").split(","),
  ].map((email) => String(email || "").trim().toLowerCase()).filter(Boolean));
}
function sourceContributor(value, actor, env) {
  const requested = clean(value?.sourceContributorEmail, 320).toLowerCase();
  if (!requested) return { user_id: actor.subject, email: actor.email, display_name: actor.name };
  if (!isManager(actor, env)) throw new Error("SOURCE_CONTRIBUTOR_MANAGER_ONLY");
  if (!memberEmails(env).has(requested)) throw new Error("SOURCE_CONTRIBUTOR_NOT_ACTIVE");
  return { email: requested, display_name: requested.split("@")[0] };
}
async function audit(action, resource, targetId, actor, details = {}) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await records.setJSON(`audit/${now.slice(0, 10)}/${now}-${id}.json`, {
    id, action, resource, targetId, at: now,
    actor: { user_id: actor.subject, email: actor.email, display_name: actor.name },
    ...details,
  }, { onlyIfNew: true, cacheControl: "no-store" });
}
function templateFields(value, resource) {
  const allowed = resource === "notes"
    ? ["meetingType", "meetingDate", "analyst", "attendeesContext", "executiveSummary", "keyTakeaway", "changeVsPreviousView", "expectationGap", "qandaHighlights", "followUps"]
    : ["marketCap", "fwdPe", "analyst", "businessIndustryOverview", "consensusGap", "financialForecast", "valuation", "catalysts", "pmFollowUp", "validationStatus", "trackingStatus", "fundamentalValidationStatus", "fundamentalValidationNotes", "validationNextCheck", "upsideTargetPct", "downsideRiskPct"];
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(allowed.map((key) => [key, clean(source[key], 40_000)]));
}
function policyPayload(value) {
  return {
    sensitivityLevel: ["public", "internal", "confidential"].includes(value.sensitivityLevel) ? value.sensitivityLevel : "internal",
    viewAllowed: false,
    downloadAllowed: false,
    // This flag means the server-side gray-box retrieval layer may rank the
    // record. It never grants another browser raw access.
    internalAiAllowed: true,
    externalAiAllowed: false,
    webSearchAllowed: false,
    redactionRequired: value.redactionRequired !== false,
  };
}
async function listRecords(resource, env, actor) {
  const listing = await records.list({ prefix: `${resource}/`, consistency: "strong", limit: 500 });
  const stored = await Promise.all(listing.blobs.map(({ key }) => records.get(key, { type: "json", consistency: "strong" })));
  const expanded = await Promise.all(stored.filter((item) => item && !item.deletedAt && canView(item, actor, env)).map((item) => clientRecord(item, env)));
  return expanded.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function researchTerms(question) {
  const normalized = clean(question, 2400).toLowerCase();
  const chunks = normalized.split(/[\s,，。；;:：()（）/]+/).filter((item) => item.length >= 2);
  const cjk = [...normalized.matchAll(/[\p{Script=Han}]{2,}/gu)].flatMap(([value]) => (
    value.length <= 4 ? [value] : [value, ...Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2))]
  ));
  return [...new Set([normalized, ...chunks, ...cjk].filter((item) => item.length >= 2))].slice(0, 24);
}

function researchScore(record, terms) {
  const metadata = `${record.title || ""} ${record.ticker || ""} ${JSON.stringify(record.templateFields || {})}`.toLowerCase();
  const content = String(record.body || record.thesis || "").toLowerCase();
  return terms.reduce((total, term) => total
    + (metadata.includes(term) ? term.length * 5 : 0)
    + (content.includes(term) ? term.length : 0), 0);
}

// Server-only gray-box retrieval. This helper is imported by agent-chat and is
// not exposed as a browser route. It strips owner identity, original titles,
// attachment names and object keys before model context is assembled.
export async function privateTeamResearchContext(question, env, limit = 6, clerkUserId = "", scope = "all") {
  const notesServiceBaseUrl = String(env.NOTES_SERVICE_BASE_URL || "").replace(/\/+$/, "");
  const retrievalToken = String(env.NOTES_RETRIEVAL_SERVICE_TOKEN || "");
  if (notesServiceBaseUrl && retrievalToken && clerkUserId) {
    const response = await fetch(`${notesServiceBaseUrl}/v1/internal/askai/private-research`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Level-Grind-Retrieval-Token": retrievalToken,
      },
      body: JSON.stringify({ question, clerkUserId, limit, scope }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`NOTES_RETRIEVAL_${response.status}`);
    const payload = await response.json();
    return (Array.isArray(payload.records) ? payload.records : [])
      .filter((record) => record.sensitivityLevel === "public"
        || (record.externalAiAllowed === true && record.redactionRequired !== true))
      .map((record, index) => ({
      id: `private-team:${record.type || "research"}:${index + 1}`,
      title: clean(record.title || `[Private team Research ${index + 1}]`, 160),
      content: clean(record.content, 5000),
      privateTeamEvidence: true,
      })).filter((entry) => entry.content);
  }
  const terms = researchTerms(question);
  const listings = await Promise.all(["notes", "ideas"].map((resource) => (
    records.list({ prefix: `${resource}/`, consistency: "strong", limit: 500 })
  )));
  const stored = (await Promise.all(listings.flatMap((listing) => listing.blobs.map(({ key }) => (
    records.get(key, { type: "json", consistency: "strong" })
  ))))).filter((item) => item && !item.deletedAt && item.internalAiAllowed === true
    && (item.sensitivityLevel === "public"
      || (item.externalAiAllowed === true && item.redactionRequired !== true)));
  const decrypted = await Promise.all(stored.map((item) => clientRecord(item, env)));
  const ranked = decrypted
    .map((record) => ({
      record,
      score: researchScore(record, terms)
        + (scope === record.resource ? 1_000 : 0),
    }))
    .sort((a, b) => b.score - a.score || String(b.record.updatedAt).localeCompare(String(a.record.updatedAt)))
    .slice(0, Math.max(1, Math.min(Number(limit) || 6, 10)));
  return ranked.map(({ record }, index) => ({
    id: `private-team:${record.resource}:${index + 1}`,
    title: `[Private team ${record.resource === "notes" ? "Note" : "Idea"} ${index + 1}]`,
    content: clean(record.resource === "notes" ? record.body : record.thesis, 5000),
    privateTeamEvidence: true,
  })).filter((entry) => entry.content);
}
function notePayload(value) { const policy = policyPayload(value); return { title: clean(value.title, 500), sourceKind: clean(value.sourceKind || "manual_note", 100), templateFields: templateFields(value.templateFields, "notes"), ...policy, aiProcessingAllowed: policy.internalAiAllowed, externalSearchAllowed: policy.webSearchAllowed, body: clean(value.body, 200_000) }; }
function ideaPayload(value) { return { title: clean(value.title, 500), ticker: clean(value.ticker, 120), thesis: clean(value.thesis, 200_000), status: ["draft", "pending_review", "approved", "rejected", "archived"].includes(value.status) ? value.status : "draft", direction: ["long", "short", "watch"].includes(value.direction) ? value.direction : "watch", noteIds: Array.isArray(value.noteIds) ? value.noteIds.map((id) => clean(id, 80)).filter(Boolean).slice(0, 100) : [], templateFields: templateFields(value.templateFields, "ideas"), ...policyPayload(value) }; }
async function sealIdeaValidation(payload, env, id) {
  if (!payload?.templateFields) return undefined;
  const validation = {
    fundamentalValidationNotes: payload.templateFields.fundamentalValidationNotes || "",
    validationNextCheck: payload.templateFields.validationNextCheck || "",
  };
  payload.templateFields = { ...payload.templateFields, fundamentalValidationNotes: undefined, validationNextCheck: undefined };
  return seal(JSON.stringify(validation), env, `ideas:${id}:validation`);
}
async function createRecord(resource, value, actor, env) {
  const payload = resource === "notes" ? notePayload(value) : ideaPayload(value); if (!payload.title) return response({ error: "标题不能为空。" }, 400);
  const id = crypto.randomUUID(); const now = new Date().toISOString(); const secretField = resource === "notes" ? "bodySecret" : "thesisSecret"; const plainField = resource === "notes" ? "body" : "thesis";
  const validationSecret = resource === "ideas" ? await sealIdeaValidation(payload, env, id) : undefined;
  const record = { ...payload, resource, id, [secretField]: await seal(payload[plainField], env, `${resource}:${id}`), validationSecret, [plainField]: undefined, version: 1, createdAt: now, updatedAt: now, owner: { user_id: actor.subject, email: actor.email, display_name: actor.name }, sourceContributor: sourceContributor(value, actor, env), createdBy: { user_id: actor.subject, email: actor.email, display_name: actor.name } };
  await records.setJSON(recordKey(resource, id), record, { onlyIfNew: true, cacheControl: "no-store" });
  await audit("create", resource, id, actor, { version: 1, sensitivityLevel: record.sensitivityLevel, sourceContributorEmail: record.sourceContributor.email });
  return response({ [resource === "notes" ? "note" : "idea"]: await clientRecord(record, env), configured: true, ingestionFrozen: false }, 201);
}
async function mutateRecord(resource, id, request, env, actor) {
  const current = await getRecord(resource, id); if (!current || current.deletedAt) return response({ error: "记录不存在。" }, 404); const value = await input(request);
  if (!canEdit(current, actor, env)) return response({ error: "只有记录贡献者或成员管理员可以修改。" }, 403);
  if (Number(value.expectedVersion) !== Number(current.version)) return response({ error: "版本冲突，请刷新后重试。", currentVersion: current.version }, 409);
  if (request.method !== "DELETE" && ((current.sensitivityLevel === "public" && value.sensitivityLevel !== "public") || (current.sensitivityLevel !== "public" && value.sensitivityLevel === "public"))) return response({ error: "Public 仅用于外源 benchmark；内部资料不能转为 Public。" }, 409);
  if (request.method === "DELETE") { const updated = { ...current, deletedAt: new Date().toISOString(), deletedBy: actor.subject, version: current.version + 1, updatedAt: new Date().toISOString() }; await records.setJSON(recordKey(resource, id), updated, { cacheControl: "no-store" }); await audit("soft_delete", resource, id, actor, { fromVersion: current.version, toVersion: updated.version }); return response({ ok: true }); }
  const payload = resource === "notes" ? notePayload(value) : ideaPayload(value); if (!payload.title) return response({ error: "标题不能为空。" }, 400);
  const secretField = resource === "notes" ? "bodySecret" : "thesisSecret"; const plainField = resource === "notes" ? "body" : "thesis";
  const validationSecret = resource === "ideas" ? await sealIdeaValidation(payload, env, id) : undefined;
  const updated = { ...current, ...payload, [secretField]: await seal(payload[plainField], env, `${resource}:${id}`), validationSecret, [plainField]: undefined, version: current.version + 1, updatedAt: new Date().toISOString(), updatedBy: actor.subject };
  await records.setJSON(recordKey(resource, id), updated, { cacheControl: "no-store" }); await audit("update", resource, id, actor, { fromVersion: current.version, toVersion: updated.version, sensitivityLevel: updated.sensitivityLevel }); return response({ [resource === "notes" ? "note" : "idea"]: await clientRecord(updated, env), configured: true, ingestionFrozen: false });
}
async function listAttachments(resource, parentId, actor, env) {
  const parent = await getRecord(resource, parentId);
  if (!parent || parent.deletedAt) return null;
  if (!canView(parent, actor, env)) return false;
  const listing = await records.list({ prefix: "attachments/", consistency: "strong", limit: 500 }); const stored = await Promise.all(listing.blobs.map(({ key }) => records.get(key, { type: "json", consistency: "strong" })));
  return stored.filter((item) => item && !item.deletedAt && item.targetId === parentId && item.targetType === (resource === "notes" ? "note" : "idea")).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
async function initAttachment(resource, parentId, value, actor, env) {
  const parent = await getRecord(resource, parentId); if (!parent || parent.deletedAt) return response({ error: "父记录不存在。" }, 404);
  if (!canEdit(parent, actor, env)) return response({ error: "只有记录贡献者或成员管理员可以上传附件。" }, 403);
  const fileName = clean(value.fileName, 300); const mediaType = clean(value.mediaType || "application/octet-stream", 160); const byteSize = Number(value.byteSize); const sha256 = clean(value.sha256, 64).toLowerCase();
  if (!fileName || !Number.isFinite(byteSize) || byteSize <= 0 || byteSize > 25 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(sha256)) return response({ error: "附件信息不完整或文件超过 25 MB。" }, 400);
  const id = crypto.randomUUID(); const now = new Date().toISOString(); const objectKey = `team/${resource}/${parentId}/${id}/${fileName.replace(/[^a-zA-Z0-9._-]+/g, "_")}`;
  const attachment = { id, targetType: resource === "notes" ? "note" : "idea", targetId: parentId, fileName, mediaType, byteSize, sha256, objectKey, uploadStatus: "initialized", parseStatus: "queued", version: 1, createdAt: now, updatedAt: now, owner: { user_id: actor.subject, email: actor.email, display_name: actor.name } };
  await records.setJSON(attachmentKey(id), attachment, { onlyIfNew: true, cacheControl: "no-store" }); await audit("attachment_init", resource, parentId, actor, { attachmentId: id, byteSize, mediaType }); const signed = await files.createUploadUrl(objectKey, { expireSeconds: 900, contentType: mediaType });
  return response({ attachment, upload: { url: signed.url, method: "PUT", headers: { "Content-Type": mediaType }, expiresAt: signed.expiresAt } }, 201);
}
async function handleAttachment(resource, suffix, request, actor, env) {
  const parent = suffix.match(/^\/([^/]+)\/attachments$/);
  if (parent) { if (request.method === "GET") { const attachments = await listAttachments(resource, parent[1], actor, env); if (attachments === null) return response({ error: "父记录不存在。" }, 404); if (attachments === false) return response({ error: "没有查看权限。" }, 403); return response({ attachments, configured: true, ingestionFrozen: false }); } if (request.method === "POST") return initAttachment(resource, parent[1], await input(request), actor, env); }
  const item = suffix.match(/^\/([^/]+)(?:\/(complete|retry))?$/); if (!item) return response({ error: "附件路径无效。" }, 404);
  const id = item[1]; const action = item[2] || "status"; const attachment = await records.get(attachmentKey(id), { type: "json", consistency: "strong" }); if (!attachment || attachment.deletedAt) return response({ error: "附件不存在。" }, 404);
  const parentRecord = await getRecord(attachment.targetType === "idea" ? "ideas" : "notes", attachment.targetId);
  if (!parentRecord || parentRecord.deletedAt) return response({ error: "父记录不存在。" }, 404);
  if (!canView(parentRecord, actor, env)) return response({ error: "没有查看权限。" }, 403);
  if (request.method !== "GET" && !canEdit(parentRecord, actor, env)) return response({ error: "只有记录贡献者或成员管理员可以修改附件。" }, 403);
  if (request.method === "GET" && action === "status") return response({ attachment });
  if (request.method === "DELETE" && action === "status") { const value = await input(request); if (Number(value.expectedVersion) !== attachment.version) return response({ error: "版本冲突，请刷新后重试。" }, 409); const updated = { ...attachment, deletedAt: new Date().toISOString(), deletedBy: actor.subject, version: attachment.version + 1, updatedAt: new Date().toISOString() }; await records.setJSON(attachmentKey(id), updated, { cacheControl: "no-store" }); await audit("attachment_delete", parentRecord.resource, parentRecord.id, actor, { attachmentId: id }); return response({ ok: true }); }
  if (request.method === "POST" && action === "complete") { const metadata = await files.getMetadata(attachment.objectKey, { consistency: "strong" }); if (!metadata) return response({ error: "文件尚未完成直传。" }, 409); const updated = { ...attachment, uploadStatus: "uploaded", parseStatus: "needs_review", parseErrorCode: "PARSING_DEFERRED", version: attachment.version + 1, updatedAt: new Date().toISOString() }; await records.setJSON(attachmentKey(id), updated, { cacheControl: "no-store" }); await audit("attachment_complete", parentRecord.resource, parentRecord.id, actor, { attachmentId: id, byteSize: attachment.byteSize }); return response({ attachment: updated }); }
  if (request.method === "POST" && action === "retry") return response({ error: "正文解析将在后端任务上线后开放；原文件已经保存。", code: "PARSING_DEFERRED" }, 501);
  return response({ error: "不支持的附件操作。" }, 405);
}

export async function nativeResearchRequest(request, env, { resource = "notes", suffix = "" } = {}) {
  const actor = await clerkIdentity(request, env);
  if (resource === "attachments") return handleAttachment("notes", suffix, request, actor, env);
  if (/\/attachments(?:\/|$)/.test(suffix)) return handleAttachment(resource, suffix, request, actor, env);
  const id = suffix.match(/^\/([^/]+)$/)?.[1];
  if (!id) { if (request.method === "GET") return response({ [resource]: await listRecords(resource, env, actor), configured: true, ingestionFrozen: false, storage: "tencent-edgeone-blob" }); if (request.method === "POST") return createRecord(resource, await input(request), actor, env); return response({ error: "不支持的请求。" }, 405); }
  if (request.method === "GET") { const record = await getRecord(resource, id); if (!record || record.deletedAt) return response({ error: "记录不存在。" }, 404); if (!canView(record, actor, env)) return response({ error: "没有查看权限。" }, 403); return response({ [resource === "notes" ? "note" : "idea"]: await clientRecord(record, env), configured: true, ingestionFrozen: false }); }
  if (["PATCH", "DELETE"].includes(request.method)) return mutateRecord(resource, id, request, env, actor);
  return response({ error: "不支持的请求。" }, 405);
}

export async function nativeContributionRequest(request, env) {
  if (request.method !== "GET") return response({ error: "不支持的请求。" }, 405);
  const actor = await clerkIdentity(request, env);
  const [noteListing, ideaListing, attachmentListing] = await Promise.all([
    records.list({ prefix: "notes/", consistency: "strong", limit: 500 }),
    records.list({ prefix: "ideas/", consistency: "strong", limit: 500 }),
    records.list({ prefix: "attachments/", consistency: "strong", limit: 500 }),
  ]);
  const load = (listing) => Promise.all(listing.blobs.map(({ key }) => records.get(key, { type: "json", consistency: "strong" })));
  const [allNotes, allIdeas, allAttachments] = await Promise.all([load(noteListing), load(ideaListing), load(attachmentListing)]);
  const notes = allNotes.filter((item) => item && !item.deletedAt);
  const ideas = allIdeas.filter((item) => item && !item.deletedAt);
  const attachments = allAttachments.filter((item) => item && !item.deletedAt && item.uploadStatus === "uploaded");
  const ownNotes = notes.filter((item) => item.owner?.user_id === actor.subject);
  const ownIdeas = ideas.filter((item) => item.owner?.user_id === actor.subject);
  const ownNoteIds = new Set(ownNotes.map((item) => item.id));
  const linkedIdeas = ideas.filter((idea) => Array.isArray(idea.noteIds) && idea.noteIds.some((id) => ownNoteIds.has(id)));
  const recent = [...ownNotes, ...ownIdeas]
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 8)
    .map((item) => ({ id: item.id, resource: item.resource, title: item.title, status: item.status || "shared", updatedAt: item.updatedAt }));
  const payload = {
    isManager: isManager(actor, env),
    mine: {
      notes: ownNotes.length,
      ideas: ownIdeas.length,
      uploadedFiles: attachments.filter((item) => item.owner?.user_id === actor.subject).length,
      linkedIdeas: linkedIdeas.length,
      pendingIdeas: ownIdeas.filter((item) => item.status === "pending_review").length,
      trackedIdeas: ownIdeas.filter((item) => item.templateFields?.trackingStatus === "tracking").length,
      recent,
    },
  };
  if (payload.isManager) {
    payload.manager = {
      pendingReview: ideas.filter((item) => item.status === "pending_review").length,
      contributors: [...new Set([...notes, ...ideas].map((item) => item.owner?.email).filter(Boolean))].length,
      confidentialRecords: [...notes, ...ideas].filter((item) => item.sensitivityLevel === "confidential").length,
    };
  }
  return response(payload);
}
