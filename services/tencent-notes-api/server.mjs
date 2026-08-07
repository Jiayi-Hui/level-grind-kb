import { createServer } from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createClerkClient, verifyToken } from "@clerk/backend";
import pg from "pg";
import { decryptText, encryptText, loadCryptoContext } from "./crypto-envelope.mjs";
import { attachmentObjectKey, createObjectStore } from "./object-store.mjs";
import { extractIdeaCandidates } from "./idea-candidate-extractor.mjs";

const { Pool } = pg;
const TEAM = "level-grind";
const port = Number(process.env.PORT || 8080);
const databaseUrl = process.env.DATABASE_URL || "";
const clerkSecretKey = process.env.CLERK_SECRET_KEY || "";
const clerkJwtKey = process.env.CLERK_JWT_KEY || "";
const gatewayServiceToken = process.env.NOTES_GATEWAY_SERVICE_TOKEN || "";
if (!databaseUrl || (!clerkSecretKey && (!clerkJwtKey || !gatewayServiceToken))) {
  throw new Error("DATABASE_URL plus Clerk verification and gateway credentials are required");
}
const cryptoContext = loadCryptoContext(); // fail closed before accepting traffic
const pool = new Pool({ connectionString: databaseUrl, max: Number(process.env.PG_POOL_MAX || 8), ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } });
const clerk = clerkSecretKey ? createClerkClient({ secretKey: clerkSecretKey }) : null;
const authorizedParties = (process.env.CLERK_AUTHORIZED_PARTIES || "https://www.level-grind.com,https://level-grind.com").split(",").map((x) => x.trim()).filter(Boolean);
function configuredEmails(...values) {
  return new Set(values.flatMap((value) => String(value || "").split(",")).map((value) => value.trim().toLowerCase()).filter(Boolean));
}
// LEVEL_GRIND_MANAGER_EMAILS is the canonical deployment setting. The two
// older names stay additive so an in-place release never removes a manager.
const ownerEmails = configuredEmails(process.env.LEVEL_GRIND_OWNER_EMAIL);
const managerEmails = configuredEmails(process.env.LEVEL_GRIND_MANAGER_EMAILS, process.env.LEVEL_GRIND_PRIMARY_PM_EMAIL, process.env.LEVEL_GRIND_MEMBER_MANAGER_EMAILS);
const managers = new Set([...ownerEmails, ...managerEmails]);
const invited = new Set([...managers, ...(process.env.LEVEL_GRIND_INVITED_EMAILS || "").split(",")].map((x) => String(x || "").trim().toLowerCase()).filter(Boolean));
const managersRoles = new Set(["Owner", "Admin", "PM", "GEM PM"]);
const ingestionFrozen = process.env.NOTES_INGESTION_ENABLED !== "true";
// This is deliberately separate from Clerk. It is only for the future AskAI
// server worker, never a browser token and never passed through EdgeOne.
const retrievalServiceToken = process.env.NOTES_RETRIEVAL_SERVICE_TOKEN || "";
const localParserBypass = process.env.NODE_ENV !== "production" && process.env.NOTES_PARSER_LOCAL_DEV_BYPASS === "true";
async function runAutoMigrations() {
  if (process.env.NOTES_AUTO_MIGRATE !== "true") return;
  const client = await pool.connect();
  try {
    for (const name of ["001_notes_p0.sql", "002_note_idea_attachments.sql", "003_notes_ideas_template_and_policy.sql", "004_private_search_index.sql", "005_three_level_classification.sql", "006_source_contributor.sql", "007_attachment_idea_candidates.sql"]) {
      await client.query(await readFile(new URL(`./migrations/${name}`, import.meta.url), "utf8"));
    }
  } finally { client.release(); }
}
function requestObjectStore(req) {
  // SCF custom-image functions inject execution-role credentials per request.
  // Fall back to explicit server-only environment variables for CloudBase/CVM.
  return createObjectStore(process.env, {
    secretId: req.headers["x-scf-secret-id"],
    secretKey: req.headers["x-scf-secret-key"],
    securityToken: req.headers["x-scf-session-token"],
  });
}

function send(res, status, value) { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); res.end(JSON.stringify(value)); }
function err(code, status = 400, more = {}) { return Object.assign(new Error(code), { status, ...more }); }
function validId(id) { return /^[0-9a-f-]{36}$/i.test(String(id || "")); }
function clean(value, max = 240) { return String(value || "").replace(/\u0000/g, "").trim().slice(0, max); }
const searchIndexKey = crypto.hkdfSync(
  "sha256",
  cryptoContext.masterKey,
  Buffer.from("level-grind-private-search", "utf8"),
  Buffer.from("blind-index-v1", "utf8"),
  32,
);
function searchTerms(value) {
  const normalized = String(value || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}._-]+/gu, " ").trim();
  const latin = normalized.split(/\s+/).filter((term) => term.length >= 2);
  const cjk = [...normalized.matchAll(/[\p{Script=Han}]{2,}/gu)].flatMap(([sequence]) => (
    sequence.length <= 4 ? [sequence] : [sequence, ...Array.from({ length: sequence.length - 1 }, (_, index) => sequence.slice(index, index + 2))]
  ));
  return [...new Set([...latin, ...cjk])].slice(0, 512);
}
function searchHashes(value) {
  return searchTerms(value).map((term) => crypto.createHmac("sha256", searchIndexKey).update(term).digest("hex"));
}
async function upsertSearchIndex(client, { entityType, entityId, parentType, parentId, ownerUserId, sensitivityLevel, text }) {
  await client.query(
    `INSERT INTO research_private_search_index (entity_type,entity_id,parent_type,parent_id,owner_user_id,sensitivity_level,key_version,term_hashes,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,1,$7::text[],now())
     ON CONFLICT (entity_type,entity_id) DO UPDATE SET parent_type=EXCLUDED.parent_type,parent_id=EXCLUDED.parent_id,owner_user_id=EXCLUDED.owner_user_id,sensitivity_level=EXCLUDED.sensitivity_level,key_version=EXCLUDED.key_version,term_hashes=EXCLUDED.term_hashes,updated_at=now()`,
    [entityType, entityId, parentType, parentId, ownerUserId, sensitivityLevel, searchHashes(text)],
  );
}
async function deleteSearchIndex(client, entityType, entityId) {
  await client.query(`DELETE FROM research_private_search_index WHERE entity_type=$1 AND entity_id=$2`, [entityType, entityId]);
}
function isLoopback(request) { const address=String(request.socket?.remoteAddress || ""); return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1"; }
async function readBody(req) { const parts = []; let size = 0; for await (const part of req) { size += part.length; if (size > 600_000) throw err("PAYLOAD_TOO_LARGE", 413); parts.push(part); } if (!parts.length) return {}; try { return JSON.parse(Buffer.concat(parts).toString("utf8")); } catch { throw err("INVALID_JSON"); } }
async function readRawBody(req, limit = 25 * 1024 * 1024 + 64 * 1024) { const chunks=[]; let size=0; for await (const chunk of req) { size += chunk.length; if (size > limit) throw err("FILE_TOO_LARGE",413); chunks.push(chunk); } return Buffer.concat(chunks); }
function binding(type, id) { return { teamId: TEAM, recordType: type, recordId: id }; }
function encrypted(prefix, value, type, id) { const e = encryptText(value, cryptoContext, binding(type, id)); return { [`${prefix}_ciphertext_b64`]: e.ciphertext_b64, [`${prefix}_nonce_b64`]: e.nonce_b64, [`${prefix}_auth_tag_b64`]: e.auth_tag_b64, [`${prefix}_wrapped_data_key_b64`]: e.wrapped_data_key_b64, [`${prefix}_key_wrap_nonce_b64`]: e.key_wrap_nonce_b64, [`${prefix}_key_wrap_auth_tag_b64`]: e.key_wrap_auth_tag_b64, [`${prefix}_key_version`]: e.key_version }; }
function decrypted(prefix, row, type) { return decryptText({ ciphertext_b64: row[`${prefix}_ciphertext_b64`], nonce_b64: row[`${prefix}_nonce_b64`], auth_tag_b64: row[`${prefix}_auth_tag_b64`], wrapped_data_key_b64: row[`${prefix}_wrapped_data_key_b64`], key_wrap_nonce_b64: row[`${prefix}_key_wrap_nonce_b64`], key_wrap_auth_tag_b64: row[`${prefix}_key_wrap_auth_tag_b64`], key_version: row[`${prefix}_key_version`] }, cryptoContext, binding(type, row.id)); }
function roleCanReview(actor) { return managersRoles.has(actor.role); }
function configuredMembershipRole(email) {
  if (ownerEmails.has(email)) return "Owner";
  if (managerEmails.has(email)) return "PM";
  return "Analyst";
}
function additiveMembershipRole(currentRole, configuredRole) {
  // Configuration may promote an existing account, but it must never silently
  // demote a stronger manually-managed role or reset an existing membership.
  if (configuredRole === "Owner" && currentRole !== "Owner") return "Owner";
  if (configuredRole === "PM" && currentRole === "Analyst") return "PM";
  return currentRole;
}
function roleCanEdit(actor, row) { return roleCanReview(actor) || row.owner_user_id === actor.id; }
function canReadRaw(actor, row) { return roleCanReview(actor) || row.owner_user_id === actor.id || row.source_contributor_user_id === actor.id; }
function serviceTokenMatches(value) {
  if (!retrievalServiceToken || !value) return false;
  const actual = Buffer.from(String(value)); const expected = Buffer.from(retrievalServiceToken);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function parseMultipartFile(request, payload) {
  const header = String(request.headers["content-type"] || ""); const boundary = header.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i)?.[1] || header.match(/boundary=(?:"[^"]+"|[^;\s]+)/i)?.[0]?.replace(/^boundary=/i, "").replace(/^"|"$/g, "");
  if (!boundary) throw err("MULTIPART_BOUNDARY_REQUIRED");
  const marker = Buffer.from(`--${boundary}`); const start = payload.indexOf(marker); if (start !== 0) throw err("INVALID_MULTIPART");
  const headerEnd = payload.indexOf(Buffer.from("\r\n\r\n"), marker.length); if (headerEnd < 0) throw err("INVALID_MULTIPART");
  const partHeader = payload.subarray(marker.length + 2, headerEnd).toString("utf8"); const name = /name="([^"]+)"/i.exec(partHeader)?.[1]; const filename = /filename="([^"]*)"/i.exec(partHeader)?.[1];
  if (name !== "file" || !filename) throw err("FILE_PART_REQUIRED");
  const contentStart = headerEnd + 4; const contentEnd = payload.lastIndexOf(Buffer.from(`\r\n--${boundary}--`)); if (contentEnd < contentStart) throw err("INVALID_MULTIPART");
  return { filename: filename.replace(/[\\/\0]/g, "_").slice(0, 240), bytes: payload.subarray(contentStart, contentEnd) };
}
async function parseDocumentOnServer(filename, bytes) {
  return await new Promise((resolve, reject) => {
    const child = spawn("python3", ["document_parser.py", filename], { cwd: process.cwd(), stdio: ["pipe", "pipe", "ignore"] }); const output=[]; let outputBytes=0; let settled=false;
    const finish=(callback)=>{if(settled)return;settled=true;clearTimeout(timer);callback();};
    const timer=setTimeout(()=>{child.kill("SIGKILL");finish(()=>reject(err("DOCUMENT_PARSER_TIMEOUT",504)));},30_000);
    child.stdout.on("data", (chunk) => { outputBytes += chunk.length; if (outputBytes > 4 * 1024 * 1024) { child.kill("SIGKILL"); return finish(()=>reject(err("DOCUMENT_PARSER_OUTPUT_TOO_LARGE",503))); } output.push(chunk); }); child.on("error", () => finish(()=>reject(err("DOCUMENT_PARSER_UNAVAILABLE",503)))); child.on("close", (code) => finish(()=>{
      if (code !== 0) return reject(err("DOCUMENT_PARSER_FAILED",503));
      try { const result=JSON.parse(Buffer.concat(output).toString("utf8")); if (!result.ok) return reject(err(result.error || "DOCUMENT_PARSE_FAILED", result.error === "FILE_TOO_LARGE" ? 413 : 422)); resolve(result.document); } catch { reject(err("DOCUMENT_PARSER_FAILED",503)); }
    })); child.stdin.end(bytes);
  });
}

function attachmentBinding(id) { return { teamId: TEAM, recordType: "attachment", recordId: id }; }
function mediaTypeFor(filename, proposed) {
  const extension = filename.includes(".") ? filename.split(".").pop().toLowerCase() : "";
  const allowed = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", md: "text/markdown", markdown: "text/markdown", txt: "text/plain" };
  if (!allowed[extension]) throw err("UNSUPPORTED_FILE", 422);
  if (proposed && String(proposed).toLowerCase() !== allowed[extension]) throw err("MEDIA_TYPE_MISMATCH", 422);
  return allowed[extension];
}
function attachmentMeta(row) { return { id: row.id, targetType: row.target_type, targetId: row.target_id, fileName: row.file_name, mediaType: row.media_type, byteSize: Number(row.byte_size), sha256: row.sha256, uploadStatus: row.upload_status, parseStatus: row.parse_status, parseErrorCode: row.parse_error_code, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at }; }
function attachmentWithExtraction(row, extraction) {
  const result = attachmentMeta(row);
  if (extraction) {
    result.extraction = { status: row.parse_status, pageCount: extraction.page_count, paragraphCount: extraction.paragraph_count, warnings: extraction.warnings || [], text: decryptText({ ciphertext_b64: extraction.text_ciphertext_b64, nonce_b64: extraction.text_nonce_b64, auth_tag_b64: extraction.text_auth_tag_b64, wrapped_data_key_b64: extraction.text_wrapped_data_key_b64, key_wrap_nonce_b64: extraction.text_key_wrap_nonce_b64, key_wrap_auth_tag_b64: extraction.text_key_wrap_auth_tag_b64, key_version: extraction.text_key_version }, cryptoContext, attachmentBinding(row.id)) };
    result.candidates = row.target_type === "idea" && Array.isArray(extraction.idea_candidates) ? extraction.idea_candidates : [];
  }
  return result;
}
async function attachmentTarget(client, type, id, actor, lock = false, requireEdit = true) {
  if (!validId(id) || !["note", "idea"].includes(type)) throw err("INVALID_ATTACHMENT_TARGET");
  const table = type === "note" ? "research_notes" : "research_ideas";
  const target = (await client.query(`SELECT * FROM ${table} WHERE id=$1 AND team_id=$2 AND deleted_at IS NULL${lock ? " FOR UPDATE" : ""}`, [id, TEAM])).rows[0];
  if (!target) throw err(`${type.toUpperCase()}_NOT_FOUND`, 404);
  if (!requireEdit && !canReadRaw(actor, target)) throw err("VIEW_FORBIDDEN", 403);
  if (requireEdit && !roleCanEdit(actor, target)) throw err("EDIT_FORBIDDEN", 403);
  return target;
}
async function createAttachmentJob(client, actor, attachmentId, purpose, status = "queued") {
  const job = (await client.query(`INSERT INTO research_background_jobs (team_id,job_type,target_type,target_id,status,attempt_count,safe_input,created_by_user_id) VALUES ($1,'file_parse','file',$2,$3,0,$4::jsonb,$5) RETURNING id`, [TEAM, attachmentId, status, JSON.stringify({ purpose, attachmentId }), actor.id])).rows[0];
  await client.query(`INSERT INTO research_attachment_jobs (attachment_id,job_id,purpose) VALUES ($1,$2,$3)`, [attachmentId, job.id, purpose]);
  return job.id;
}
async function listAttachments(type, targetId, actor) {
  const client = await pool.connect();
  try { await client.query("BEGIN"); await attachmentTarget(client, type, targetId, actor, false, false); const rows = (await client.query(`SELECT * FROM research_attachments WHERE team_id=$1 AND target_type=$2 AND target_id=$3 AND deleted_at IS NULL ORDER BY created_at DESC`, [TEAM, type, targetId])).rows; const results = []; for (const row of rows) { const extraction = (await client.query(`SELECT * FROM research_attachment_extractions WHERE attachment_id=$1`, [row.id])).rows[0]; results.push(attachmentWithExtraction(row, extraction)); await audit(client, actor, "file", row.id, "view", row.version, row.version, { surface: "attachments_list" }); } await client.query("COMMIT"); return results; }
  catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
function attachmentInput(raw) {
  const filename = clean(raw.fileName, 240).replace(/[\\/\0]/g, "_"); const byteSize = Number(raw.byteSize); const sha256 = clean(raw.sha256, 64).toLowerCase();
  if (!filename || !Number.isInteger(byteSize) || byteSize < 1 || byteSize > 25 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(sha256)) throw err("INVALID_ATTACHMENT_METADATA");
  return { fileName: filename, mediaType: mediaTypeFor(filename, raw.mediaType), byteSize, sha256 };
}
async function initAttachment(type, targetId, actor, raw, objectStore) {
  if (!objectStore.configured) throw err("OBJECT_STORE_NOT_CONFIGURED", 503);
  const input = attachmentInput(raw); const id = crypto.randomUUID(); const objectKey = attachmentObjectKey(TEAM, type, targetId, id, input.fileName); const client = await pool.connect();
  try { await client.query("BEGIN"); await attachmentTarget(client, type, targetId, actor, true); const row = (await client.query(`INSERT INTO research_attachments (id,team_id,target_type,target_id,created_by_user_id,object_key,file_name,media_type,byte_size,sha256) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [id, TEAM, type, targetId, actor.id, objectKey, input.fileName, input.mediaType, input.byteSize, input.sha256])).rows[0]; const jobId = await createAttachmentJob(client, actor, id, "upload"); await audit(client, actor, "file", id, "upload_init", null, row.version, { targetType: type, targetId, fileName: input.fileName, byteSize: input.byteSize, jobId }); await client.query("COMMIT"); const upload = objectStore.directUpload ? await objectStore.presignPut(objectKey, input) : { mode: "server_complete", endpoint: `/v1/attachments/${id}/complete` }; return { attachment: attachmentMeta(row), upload: objectStore.directUpload ? { mode: "presigned_put", endpoint: `/v1/attachments/${id}/complete`, ...upload } : upload, jobId }; }
  catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
async function findAttachmentForEdit(client, attachmentId, actor, lock = false) {
  if (!validId(attachmentId)) throw err("INVALID_ATTACHMENT_ID");
  const row = (await client.query(`SELECT * FROM research_attachments WHERE id=$1 AND team_id=$2 AND deleted_at IS NULL${lock ? " FOR UPDATE" : ""}`, [attachmentId, TEAM])).rows[0];
  if (!row) throw err("ATTACHMENT_NOT_FOUND", 404); await attachmentTarget(client, row.target_type, row.target_id, actor, lock); return row;
}
async function findAttachmentForRead(client, attachmentId, actor) {
  if (!validId(attachmentId)) throw err("INVALID_ATTACHMENT_ID");
  const row = (await client.query(`SELECT * FROM research_attachments WHERE id=$1 AND team_id=$2 AND deleted_at IS NULL`, [attachmentId, TEAM])).rows[0];
  if (!row) throw err("ATTACHMENT_NOT_FOUND", 404); await attachmentTarget(client, row.target_type, row.target_id, actor, false, false); return row;
}
async function saveAttachmentExtraction(client, row, document) {
  const e = encryptText(document.text || "", cryptoContext, attachmentBinding(row.id));
  const candidates = row.target_type === "idea" ? extractIdeaCandidates({ fileName: row.file_name, text: document.text || "" }) : [];
  await client.query(`INSERT INTO research_attachment_extractions (attachment_id,text_ciphertext_b64,text_nonce_b64,text_auth_tag_b64,text_wrapped_data_key_b64,text_key_wrap_nonce_b64,text_key_wrap_auth_tag_b64,text_key_version,page_count,paragraph_count,warnings,idea_candidates,extracted_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,now(),now()) ON CONFLICT (attachment_id) DO UPDATE SET text_ciphertext_b64=EXCLUDED.text_ciphertext_b64,text_nonce_b64=EXCLUDED.text_nonce_b64,text_auth_tag_b64=EXCLUDED.text_auth_tag_b64,text_wrapped_data_key_b64=EXCLUDED.text_wrapped_data_key_b64,text_key_wrap_nonce_b64=EXCLUDED.text_key_wrap_nonce_b64,text_key_wrap_auth_tag_b64=EXCLUDED.text_key_wrap_auth_tag_b64,text_key_version=EXCLUDED.text_key_version,page_count=EXCLUDED.page_count,paragraph_count=EXCLUDED.paragraph_count,warnings=EXCLUDED.warnings,idea_candidates=EXCLUDED.idea_candidates,extracted_at=now(),updated_at=now()`, [row.id,e.ciphertext_b64,e.nonce_b64,e.auth_tag_b64,e.wrapped_data_key_b64,e.key_wrap_nonce_b64,e.key_wrap_auth_tag_b64,e.key_version,document.pageCount || null,document.paragraphCount || null,JSON.stringify(document.warnings || []),JSON.stringify(candidates)]);
  const table = row.target_type === "note" ? "research_notes" : "research_ideas";
  const parent = (await client.query(`SELECT owner_user_id,sensitivity_level FROM ${table} WHERE id=$1 AND team_id=$2 AND deleted_at IS NULL`, [row.target_id, TEAM])).rows[0];
  if (parent) await upsertSearchIndex(client, { entityType: "attachment", entityId: row.id, parentType: row.target_type, parentId: row.target_id, ownerUserId: parent.owner_user_id, sensitivityLevel: parent.sensitivity_level, text: `${row.file_name} ${document.text || ""}` });
  return candidates;
}
async function completeAttachment(attachmentId, actor, file, objectStore) {
  if (!objectStore.configured) throw err("OBJECT_STORE_NOT_CONFIGURED", 503); if (!objectStore.directUpload && (!file || file.bytes.length > 25 * 1024 * 1024)) throw err("FILE_TOO_LARGE", 413);
  const client = await pool.connect(); let row; let stored = false;
  try { await client.query("BEGIN"); row = await findAttachmentForEdit(client, attachmentId, actor, true); if (row.upload_status !== "initialized") throw err("ATTACHMENT_ALREADY_COMPLETED", 409); if (!objectStore.directUpload) { const digest = crypto.createHash("sha256").update(file.bytes).digest("hex"); if (file.filename !== row.file_name || file.bytes.length !== Number(row.byte_size) || digest !== row.sha256) throw err("ATTACHMENT_CONTENT_MISMATCH", 422); } await client.query(`UPDATE research_attachments SET upload_status='uploaded',parse_status='processing',version=version+1,updated_at=now() WHERE id=$1`, [row.id]); await client.query(`UPDATE research_background_jobs SET status='running',attempt_count=attempt_count+1,started_at=now() WHERE id IN (SELECT job_id FROM research_attachment_jobs WHERE attachment_id=$1 AND purpose='upload') AND status='queued'`, [row.id]); await client.query("COMMIT");
    let bytes; if (objectStore.directUpload) { const head = await objectStore.head(row.object_key); if (head.byteSize !== Number(row.byte_size) || head.sha256 !== row.sha256) throw err("ATTACHMENT_CONTENT_MISMATCH", 422); bytes = await objectStore.get(row.object_key); if (bytes.length !== Number(row.byte_size) || crypto.createHash("sha256").update(bytes).digest("hex") !== row.sha256) throw err("ATTACHMENT_CONTENT_MISMATCH", 422); } else { await objectStore.put(row.object_key, file.bytes); stored = true; bytes = file.bytes; } const document = await parseDocumentOnServer(row.file_name, bytes); const parseStatus = document.status === "ocr_required" ? "needs_review" : (document.status === "partial" ? "partial" : "ready");
    await client.query("BEGIN"); const candidates = await saveAttachmentExtraction(client, row, document); const updated = (await client.query(`UPDATE research_attachments SET parse_status=$2,parse_error_code=NULL,version=version+1,updated_at=now() WHERE id=$1 RETURNING *`, [row.id, parseStatus])).rows[0]; await client.query(`UPDATE research_background_jobs SET status='succeeded',finished_at=now(),safe_result=$2::jsonb WHERE id IN (SELECT job_id FROM research_attachment_jobs WHERE attachment_id=$1) AND status IN ('queued','running')`, [row.id, JSON.stringify({ parseStatus, byteSize: Number(row.byte_size), candidateCount: candidates.length })]); await audit(client, actor, "file", row.id, "upload_complete", row.version, updated.version, { parseStatus }); await audit(client, actor, "file", row.id, "parse", updated.version, updated.version, { parseStatus, warnings: (document.warnings || []).length, candidateCount: candidates.length }); await client.query("COMMIT"); return { ...attachmentMeta(updated), extraction: { status: parseStatus, pageCount: document.pageCount || null, paragraphCount: document.paragraphCount || null, warnings: document.warnings || [], text: document.text || "" }, candidates };
  } catch (error) { try { await client.query("ROLLBACK"); if (row) { await pool.query(`UPDATE research_attachments SET upload_status=CASE WHEN upload_status='initialized' THEN 'failed' ELSE upload_status END,parse_status='failed',parse_error_code=$2,version=version+1,updated_at=now() WHERE id=$1 AND deleted_at IS NULL`, [row.id, clean(error.message, 100)]); await pool.query(`UPDATE research_background_jobs SET status='failed',error_code=$2,finished_at=now() WHERE id IN (SELECT job_id FROM research_attachment_jobs WHERE attachment_id=$1) AND status IN ('queued','running')`, [row.id, clean(error.message, 100)]); } } catch {} if (stored && row) { try { await objectStore.remove(row.object_key); } catch {} } throw error; }
  finally { client.release(); }
}
async function attachmentStatus(attachmentId, actor) {
  const client = await pool.connect(); try { await client.query("BEGIN"); const row = await findAttachmentForRead(client, attachmentId, actor); const extraction = (await client.query(`SELECT * FROM research_attachment_extractions WHERE attachment_id=$1`, [row.id])).rows[0]; await audit(client, actor, "file", row.id, "view", row.version, row.version, { surface: "attachment_status" }); await client.query("COMMIT"); return attachmentWithExtraction(row, extraction); }
  catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
async function retryAttachment(attachmentId, actor, objectStore) {
  if (!objectStore.configured) throw err("OBJECT_STORE_NOT_CONFIGURED", 503); const client = await pool.connect(); let row; let jobId;
  try { await client.query("BEGIN"); row = await findAttachmentForEdit(client, attachmentId, actor, true); if (row.upload_status !== "uploaded") throw err("ATTACHMENT_NOT_UPLOADED", 409); await client.query(`UPDATE research_attachments SET parse_status='processing',parse_error_code=NULL,version=version+1,updated_at=now() WHERE id=$1`, [row.id]); jobId = await createAttachmentJob(client, actor, row.id, "retry", "running"); await audit(client, actor, "file", row.id, "retry", row.version, row.version + 1, { jobId }); await client.query("COMMIT"); const document = await parseDocumentOnServer(row.file_name, await objectStore.get(row.object_key)); const parseStatus = document.status === "ocr_required" ? "needs_review" : (document.status === "partial" ? "partial" : "ready"); await client.query("BEGIN"); const candidates = await saveAttachmentExtraction(client, row, document); const updated = (await client.query(`UPDATE research_attachments SET parse_status=$2,version=version+1,updated_at=now() WHERE id=$1 RETURNING *`, [row.id, parseStatus])).rows[0]; await client.query(`UPDATE research_background_jobs SET status='succeeded',finished_at=now(),safe_result=$2::jsonb WHERE id=$1`, [jobId, JSON.stringify({ parseStatus, candidateCount: candidates.length })]); await audit(client, actor, "file", row.id, "parse", updated.version, updated.version, { retry: true, parseStatus, candidateCount: candidates.length }); await client.query("COMMIT"); return { ...attachmentMeta(updated), candidates }; }
  catch (error) { try { await client.query("ROLLBACK"); if (row) await pool.query(`UPDATE research_attachments SET parse_status='failed',parse_error_code=$2,version=version+1,updated_at=now() WHERE id=$1 AND deleted_at IS NULL`, [row.id, clean(error.message, 100)]); if (jobId) await pool.query(`UPDATE research_background_jobs SET status='failed',error_code=$2,finished_at=now() WHERE id=$1`, [jobId, clean(error.message, 100)]); } catch {} throw error; } finally { client.release(); }
}
async function deleteAttachment(attachmentId, actor, expectedVersion, objectStore) {
  const client = await pool.connect(); let row;
  try { await client.query("BEGIN"); row = await findAttachmentForEdit(client, attachmentId, actor, true); if (Number(expectedVersion) !== row.version) throw err("VERSION_CONFLICT", 409, { currentVersion: row.version }); const updated = (await client.query(`UPDATE research_attachments SET deleted_at=now(),deleted_by_user_id=$2,version=version+1,updated_at=now() WHERE id=$1 RETURNING *`, [row.id, actor.id])).rows[0]; await deleteSearchIndex(client, "attachment", row.id); await audit(client, actor, "file", row.id, "soft_delete", row.version, updated.version, {}); await client.query("COMMIT"); if (objectStore.configured) await objectStore.remove(row.object_key); return attachmentMeta(updated); }
  catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function identity(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, ""); if (!token) throw err("SIGN_IN_REQUIRED", 401);
  const jwt = await verifyToken(token, { ...(clerkJwtKey ? { jwtKey: clerkJwtKey } : { secretKey: clerkSecretKey }), authorizedParties });
  const suppliedGatewayToken = String(req.headers["x-level-grind-service-token"] || "");
  const trustedGateway = gatewayServiceToken && suppliedGatewayToken.length === gatewayServiceToken.length
    && crypto.timingSafeEqual(Buffer.from(suppliedGatewayToken), Buffer.from(gatewayServiceToken));
  const forwardedSubject = clean(req.headers["x-level-grind-subject"], 128);
  let email = ""; let displayName = "";
  if (trustedGateway && forwardedSubject === jwt.sub) {
    email = clean(req.headers["x-level-grind-email"], 320).toLowerCase();
    displayName = clean(req.headers["x-level-grind-name"], 240);
  } else if (clerk) {
    const clerkUser = await clerk.users.getUser(jwt.sub);
    if (clerkUser.banned || clerkUser.locked) throw err("TEAM_ACCESS_REQUIRED", 403);
    email = (clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress || "").trim().toLowerCase();
    displayName = clerkUser.fullName || clerkUser.firstName || "";
  } else {
    throw err("TRUSTED_GATEWAY_REQUIRED", 401);
  }
  if (!email || !invited.has(email)) throw err("TEAM_ACCESS_REQUIRED", 403);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = (await client.query(`INSERT INTO research_users (clerk_user_id,email,display_name,status) VALUES ($1,$2,$3,'active') ON CONFLICT (clerk_user_id) DO UPDATE SET email=EXCLUDED.email,display_name=EXCLUDED.display_name,updated_at=now() RETURNING *`, [jwt.sub, email, displayName || email.split("@")[0]])).rows[0];
    let membership = (await client.query(`SELECT * FROM research_team_memberships WHERE team_id=$1 AND user_id=$2 FOR UPDATE`, [TEAM, user.id])).rows[0];
    const configuredRole = configuredMembershipRole(email);
    if (!membership) {
      membership = (await client.query(`INSERT INTO research_team_memberships (team_id,user_id,role,status) VALUES ($1,$2,$3,'active') RETURNING *`, [TEAM, user.id, configuredRole])).rows[0];
    } else if (membership.status === "active") {
      const upgradedRole = additiveMembershipRole(membership.role, configuredRole);
      if (upgradedRole !== membership.role) {
        membership = (await client.query(`UPDATE research_team_memberships SET role=$3,updated_at=now() WHERE team_id=$1 AND user_id=$2 RETURNING *`, [TEAM, user.id, upgradedRole])).rows[0];
      }
    }
    if (membership.status !== "active" || user.status !== "active") throw err("TEAM_ACCESS_REQUIRED", 403);
    await client.query("COMMIT"); return { id: user.id, clerkUserId: jwt.sub, email, name: user.display_name, role: membership.role };
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}
async function audit(client, actor, entityType, entityId, action, previousVersion, nextVersion, metadata = {}) {
  await client.query(`INSERT INTO research_audit_log (team_id,entity_type,entity_id,actor_user_id,action,previous_version,next_version,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`, [TEAM, entityType, entityId, actor.id, action, previousVersion, nextVersion, JSON.stringify(metadata)]);
}
function policyMeta(row, type) {
  const internalAiAllowed = type === "note" ? row.ai_processing_allowed === true : row.internal_ai_allowed === true;
  const webSearchAllowed = type === "note" ? row.external_search_allowed === true : row.web_search_allowed === true;
  return {
    sensitivityLevel: row.sensitivity_level || "internal",
    viewAllowed: row.view_allowed !== false,
    internalAiAllowed,
    externalAiAllowed: row.external_ai_allowed === true,
    webSearchAllowed,
    downloadAllowed: row.download_allowed === true,
    redactionRequired: row.redaction_required === true,
    // Legacy aliases keep current static clients and existing EdgeOne routes compatible.
    aiProcessingAllowed: internalAiAllowed,
    externalSearchAllowed: webSearchAllowed,
  };
}
function attributionMeta(row) { return { owner: { display_name: row.owner_name, email: row.owner_email }, sourceContributor: { display_name: row.source_contributor_name || row.owner_name, email: row.source_contributor_email || row.owner_email }, createdBy: { display_name: row.created_by_name || row.owner_name, email: row.created_by_email || row.owner_email } }; }
function noteMeta(row) { return { id: row.id, title: row.title, sourceKind: row.source_kind, templateFields: row.template_fields || {}, ...policyMeta(row, "note"), version: row.version, createdAt: row.created_at, updatedAt: row.updated_at, ...attributionMeta(row) }; }
function ideaMeta(row) { return { id: row.id, title: row.title, ticker: row.ticker, direction: row.direction, status: row.status, templateFields: row.template_fields || {}, ...policyMeta(row, "idea"), noteIds: row.note_ids || [], noteTitles: row.note_titles || [], version: row.version, createdAt: row.created_at, updatedAt: row.updated_at, ...attributionMeta(row) }; }
async function listEntity(type, actor) {
  const table = type === "note" ? "research_notes" : "research_ideas";
  const ideaLinks = type === "idea" ? `, COALESCE((SELECT array_agg(l.note_id ORDER BY l.created_at) FROM research_idea_note_links l JOIN research_notes n ON n.id=l.note_id WHERE l.idea_id=x.id AND l.deleted_at IS NULL AND n.deleted_at IS NULL), ARRAY[]::uuid[]) AS note_ids, COALESCE((SELECT array_agg(n.title ORDER BY l.created_at) FROM research_idea_note_links l JOIN research_notes n ON n.id=l.note_id WHERE l.idea_id=x.id AND l.deleted_at IS NULL AND n.deleted_at IS NULL), ARRAY[]::text[]) AS note_titles` : "";
  const result = await pool.query(`SELECT x.*,u.display_name owner_name,u.email owner_email,source.display_name source_contributor_name,source.email source_contributor_email,creator.display_name created_by_name,creator.email created_by_email ${ideaLinks} FROM ${table} x JOIN research_users u ON u.id=x.owner_user_id JOIN research_users source ON source.id=x.source_contributor_user_id JOIN research_users creator ON creator.id=x.created_by_user_id WHERE x.team_id=$1 AND x.deleted_at IS NULL ORDER BY x.updated_at DESC LIMIT 250`, [TEAM]);
  if (result.rows.length) {
    const client = await pool.connect();
    try { await client.query("BEGIN"); for (const row of result.rows) await audit(client, actor, type, row.id, "view", row.version, row.version, { surface: "list_metadata" }); await client.query("COMMIT"); }
    catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  return result.rows.filter((row) => canReadRaw(actor, row)).map(type === "note" ? noteMeta : ideaMeta);
}
function templateFields(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key)) continue;
    result[key] = clean(value, 20_000);
  }
  return result;
}
async function resolveSourceContributor(client, actor, sourceContributorEmail) {
  if (!sourceContributorEmail) return actor;
  if (!roleCanReview(actor)) throw err("SOURCE_CONTRIBUTOR_MANAGER_ONLY", 403);
  const source = (await client.query(
    `SELECT u.id,u.email,u.display_name,m.role
       FROM research_users u
       JOIN research_team_memberships m ON m.user_id=u.id AND m.team_id=$2 AND m.status='active'
      WHERE lower(u.email)=lower($1) AND u.status='active'`,
    [sourceContributorEmail, TEAM],
  )).rows[0];
  if (!source) throw err("SOURCE_CONTRIBUTOR_NOT_ACTIVE", 400);
  return { id: source.id, email: source.email, name: source.display_name, role: source.role };
}
function normal(type, raw, operation) {
  const id = operation === "create" ? crypto.randomUUID() : clean(raw.id, 36); if (!validId(id)) throw err("INVALID_ID");
  const title = clean(raw.title); const text = String(raw[type === "note" ? "body" : "thesis"] || "").replace(/\u0000/g, ""); const expectedVersion = Number(raw.expectedVersion);
  if (operation !== "delete" && (!title || !text)) throw err("TITLE_AND_CONTENT_REQUIRED"); if (text.length > 500_000) throw err("CONTENT_TOO_LARGE", 413);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0 || (operation === "create" && expectedVersion !== 0)) throw err("INVALID_VERSION");
  const sourceContributorEmail = clean(raw.sourceContributorEmail, 320).toLowerCase();
  if (operation !== "create" && sourceContributorEmail) throw err("SOURCE_CONTRIBUTOR_IMMUTABLE", 409);
  // Raw analyst uploads are private by default. Sharing, downloading and any
  // external processing must happen through a future manager-reviewed flow.
  const policy = { sensitivityLevel: ["public","internal","confidential"].includes(raw.sensitivityLevel) ? raw.sensitivityLevel : "internal", viewAllowed: false, internalAiAllowed: raw.internalAiAllowed === true || raw.aiProcessingAllowed === true, externalAiAllowed: false, webSearchAllowed: false, downloadAllowed: false, redactionRequired: raw.redactionRequired !== false };
  if (type === "note") return { id, title, text, expectedVersion, sourceContributorEmail, sourceKind: clean(raw.sourceKind || "manual_note", 80).replace(/[^a-z0-9_-]/gi, "_") || "manual_note", templateFields: templateFields(raw.templateFields), ...policy };
  const noteIds = Array.isArray(raw.noteIds) ? [...new Set(raw.noteIds.map((noteId) => clean(noteId, 36)))].filter(validId) : [];
  if (Array.isArray(raw.noteIds) && noteIds.length !== raw.noteIds.length) throw err("INVALID_NOTE_IDS");
  return { id, title, text, expectedVersion, sourceContributorEmail, ticker: clean(raw.ticker, 32).toUpperCase(), noteIds, direction: ["long","short","watch"].includes(raw.direction) ? raw.direction : "watch", status: ["draft","pending_review","approved","rejected","archived"].includes(raw.status) ? raw.status : "draft", templateFields: templateFields(raw.templateFields), ...policy };
}
async function reconcileIdeaNotes(client, ideaId, noteIds, actor) {
  if (noteIds.length) {
    const valid = await client.query(`SELECT id FROM research_notes WHERE team_id=$1 AND deleted_at IS NULL AND id = ANY($2::uuid[]) FOR KEY SHARE`, [TEAM, noteIds]);
    if (valid.rows.length !== noteIds.length) throw err("IDEA_NOTE_NOT_FOUND", 400);
  }
  await client.query(`UPDATE research_idea_note_links SET deleted_at=now() WHERE idea_id=$1 AND deleted_at IS NULL AND NOT (note_id = ANY($2::uuid[]))`, [ideaId, noteIds]);
  for (const noteId of noteIds) await client.query(`INSERT INTO research_idea_note_links (idea_id,note_id,created_by_user_id) VALUES ($1,$2,$3) ON CONFLICT (idea_id,note_id) DO UPDATE SET deleted_at=NULL,created_by_user_id=EXCLUDED.created_by_user_id,created_at=now()`, [ideaId, noteId, actor.id]);
}
async function createEntity(type, actor, input) {
  const client = await pool.connect(); try { await client.query("BEGIN");
    const source = await resolveSourceContributor(client, actor, input.sourceContributorEmail);
    if (type === "note") { const e=encrypted("body",input.text,type,input.id); const r=(await client.query(`INSERT INTO research_notes (id,team_id,owner_user_id,source_contributor_user_id,created_by_user_id,title,body_ciphertext_b64,body_nonce_b64,body_auth_tag_b64,body_wrapped_data_key_b64,body_key_wrap_nonce_b64,body_key_wrap_auth_tag_b64,body_key_version,source_kind,sensitivity_level,template_fields,view_allowed,ai_processing_allowed,external_ai_allowed,external_search_allowed,download_allowed,redaction_required) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19,$20,$21,$22) RETURNING *`, [input.id,TEAM,actor.id,source.id,actor.id,input.title,e.body_ciphertext_b64,e.body_nonce_b64,e.body_auth_tag_b64,e.body_wrapped_data_key_b64,e.body_key_wrap_nonce_b64,e.body_key_wrap_auth_tag_b64,e.body_key_version,input.sourceKind,input.sensitivityLevel,JSON.stringify(input.templateFields),input.viewAllowed,input.internalAiAllowed,input.externalAiAllowed,input.webSearchAllowed,input.downloadAllowed,input.redactionRequired])).rows[0]; await upsertSearchIndex(client,{entityType:"note",entityId:r.id,parentType:"note",parentId:r.id,ownerUserId:actor.id,sensitivityLevel:r.sensitivity_level,text:`${input.title} ${JSON.stringify(input.templateFields)} ${input.text}`}); await audit(client,actor,type,r.id,"create",null,1,{sourceKind:input.sourceKind,sensitivityLevel:input.sensitivityLevel,redactionRequired:input.redactionRequired,sourceContributorUserId:source.id}); await client.query("COMMIT"); return noteMeta({...r,owner_name:actor.name,owner_email:actor.email,source_contributor_name:source.name,source_contributor_email:source.email,created_by_name:actor.name,created_by_email:actor.email}); }
    if (!["draft", "pending_review"].includes(input.status) && !roleCanReview(actor)) throw err("IDEA_REVIEW_FORBIDDEN", 403);
    const e=encrypted("thesis",input.text,type,input.id); const r=(await client.query(`INSERT INTO research_ideas (id,team_id,owner_user_id,source_contributor_user_id,created_by_user_id,title,ticker,direction,status,thesis_ciphertext_b64,thesis_nonce_b64,thesis_auth_tag_b64,thesis_wrapped_data_key_b64,thesis_key_wrap_nonce_b64,thesis_key_wrap_auth_tag_b64,thesis_key_version,template_fields,sensitivity_level,view_allowed,internal_ai_allowed,external_ai_allowed,web_search_allowed,download_allowed,redaction_required) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20,$21,$22,$23,$24) RETURNING *`, [input.id,TEAM,actor.id,source.id,actor.id,input.title,input.ticker,input.direction,input.status,e.thesis_ciphertext_b64,e.thesis_nonce_b64,e.thesis_auth_tag_b64,e.thesis_wrapped_data_key_b64,e.thesis_key_wrap_nonce_b64,e.thesis_key_wrap_auth_tag_b64,e.thesis_key_version,JSON.stringify(input.templateFields),input.sensitivityLevel,input.viewAllowed,input.internalAiAllowed,input.externalAiAllowed,input.webSearchAllowed,input.downloadAllowed,input.redactionRequired])).rows[0]; await reconcileIdeaNotes(client,r.id,input.noteIds,actor); await upsertSearchIndex(client,{entityType:"idea",entityId:r.id,parentType:"idea",parentId:r.id,ownerUserId:actor.id,sensitivityLevel:r.sensitivity_level,text:`${input.title} ${input.ticker} ${JSON.stringify(input.templateFields)} ${input.text}`}); await audit(client,actor,type,r.id,"create",null,1,{ticker:input.ticker,direction:input.direction,status:input.status,noteCount:input.noteIds.length,sensitivityLevel:input.sensitivityLevel,sourceContributorUserId:source.id}); await client.query("COMMIT"); return ideaMeta({...r,owner_name:actor.name,owner_email:actor.email,source_contributor_name:source.name,source_contributor_email:source.email,created_by_name:actor.name,created_by_email:actor.email,note_ids:input.noteIds,note_titles:[]});
  } catch(e){await client.query("ROLLBACK");throw e;} finally{client.release();}
}
async function getEntity(type,id,actor) { const client=await pool.connect(); try { await client.query("BEGIN"); const table=type === "note" ? "research_notes":"research_ideas"; const ideaLinks=type === "idea" ? `, COALESCE((SELECT array_agg(l.note_id ORDER BY l.created_at) FROM research_idea_note_links l JOIN research_notes n ON n.id=l.note_id WHERE l.idea_id=x.id AND l.deleted_at IS NULL AND n.deleted_at IS NULL), ARRAY[]::uuid[]) AS note_ids, COALESCE((SELECT array_agg(n.title ORDER BY l.created_at) FROM research_idea_note_links l JOIN research_notes n ON n.id=l.note_id WHERE l.idea_id=x.id AND l.deleted_at IS NULL AND n.deleted_at IS NULL), ARRAY[]::text[]) AS note_titles` : ""; const row=(await client.query(`SELECT x.*,u.display_name owner_name,u.email owner_email,source.display_name source_contributor_name,source.email source_contributor_email,creator.display_name created_by_name,creator.email created_by_email ${ideaLinks} FROM ${table} x JOIN research_users u ON u.id=x.owner_user_id JOIN research_users source ON source.id=x.source_contributor_user_id JOIN research_users creator ON creator.id=x.created_by_user_id WHERE x.id=$1 AND x.team_id=$2 AND x.deleted_at IS NULL FOR UPDATE`,[id,TEAM])).rows[0]; if(!row) throw err(`${type.toUpperCase()}_NOT_FOUND`,404); if(!canReadRaw(actor,row)) throw err("VIEW_FORBIDDEN",403); await audit(client,actor,type,id,"view",row.version,row.version,{surface:"detail"}); await client.query("COMMIT"); return {...(type === "note" ? noteMeta(row):ideaMeta(row)), [type === "note" ? "body":"thesis"]:decrypted(type === "note" ? "body":"thesis",row,type)}; } catch(e){await client.query("ROLLBACK");throw e;} finally{client.release();} }
async function mutateEntity(type,actor,input,operation) { const client=await pool.connect(); try { await client.query("BEGIN"); const table=type === "note"?"research_notes":"research_ideas"; const row=(await client.query(`SELECT * FROM ${table} WHERE id=$1 AND team_id=$2 AND deleted_at IS NULL FOR UPDATE`,[input.id,TEAM])).rows[0]; if(!row)throw err(`${type.toUpperCase()}_NOT_FOUND`,404); if(row.version!==input.expectedVersion)throw err("VERSION_CONFLICT",409,{currentVersion:row.version}); if(!roleCanEdit(actor,row))throw err("EDIT_FORBIDDEN",403); let next;
    if(operation !== "delete" && ((row.sensitivity_level === "public" && input.sensitivityLevel !== "public") || (row.sensitivity_level !== "public" && input.sensitivityLevel === "public"))) throw err("CLASSIFICATION_TRANSITION_FORBIDDEN",409);
    if(operation === "delete") next=(await client.query(`UPDATE ${table} SET deleted_at=now(),deleted_by_user_id=$2,version=version+1,updated_at=now() WHERE id=$1 RETURNING *`,[input.id,actor.id])).rows[0];
    else if(type === "note") {const e=encrypted("body",input.text,type,input.id); next=(await client.query(`UPDATE research_notes SET title=$2,body_ciphertext_b64=$3,body_nonce_b64=$4,body_auth_tag_b64=$5,body_wrapped_data_key_b64=$6,body_key_wrap_nonce_b64=$7,body_key_wrap_auth_tag_b64=$8,body_key_version=$9,source_kind=$10,sensitivity_level=$11,template_fields=$12::jsonb,view_allowed=$13,ai_processing_allowed=$14,external_ai_allowed=$15,external_search_allowed=$16,download_allowed=$17,redaction_required=$18,version=version+1,updated_at=now() WHERE id=$1 RETURNING *`,[input.id,input.title,e.body_ciphertext_b64,e.body_nonce_b64,e.body_auth_tag_b64,e.body_wrapped_data_key_b64,e.body_key_wrap_nonce_b64,e.body_key_wrap_auth_tag_b64,e.body_key_version,input.sourceKind,input.sensitivityLevel,JSON.stringify(input.templateFields),input.viewAllowed,input.internalAiAllowed,input.externalAiAllowed,input.webSearchAllowed,input.downloadAllowed,input.redactionRequired])).rows[0];}
    else {if(input.status !== row.status && !["draft", "pending_review"].includes(input.status) && !roleCanReview(actor)) throw err("IDEA_REVIEW_FORBIDDEN",403); const e=encrypted("thesis",input.text,type,input.id); next=(await client.query(`UPDATE research_ideas SET title=$2,ticker=$3,direction=$4,status=$5,thesis_ciphertext_b64=$6,thesis_nonce_b64=$7,thesis_auth_tag_b64=$8,thesis_wrapped_data_key_b64=$9,thesis_key_wrap_nonce_b64=$10,thesis_key_wrap_auth_tag_b64=$11,thesis_key_version=$12,template_fields=$13::jsonb,sensitivity_level=$14,view_allowed=$15,internal_ai_allowed=$16,external_ai_allowed=$17,web_search_allowed=$18,download_allowed=$19,redaction_required=$20,version=version+1,updated_at=now() WHERE id=$1 RETURNING *`,[input.id,input.title,input.ticker,input.direction,input.status,e.thesis_ciphertext_b64,e.thesis_nonce_b64,e.thesis_auth_tag_b64,e.thesis_wrapped_data_key_b64,e.thesis_key_wrap_nonce_b64,e.thesis_key_wrap_auth_tag_b64,e.thesis_key_version,JSON.stringify(input.templateFields),input.sensitivityLevel,input.viewAllowed,input.internalAiAllowed,input.externalAiAllowed,input.webSearchAllowed,input.downloadAllowed,input.redactionRequired])).rows[0]; await reconcileIdeaNotes(client,input.id,input.noteIds,actor);}
    if(operation === "delete") await deleteSearchIndex(client,type,input.id); else await upsertSearchIndex(client,{entityType:type,entityId:input.id,parentType:type,parentId:input.id,ownerUserId:row.owner_user_id,sensitivityLevel:next.sensitivity_level,text:type === "note" ? `${input.title} ${JSON.stringify(input.templateFields)} ${input.text}` : `${input.title} ${input.ticker} ${JSON.stringify(input.templateFields)} ${input.text}`});
    await audit(client,actor,type,input.id,operation === "delete" ? "soft_delete":"update",row.version,next.version,{...(type === "idea" && operation !== "delete" ? {ticker:input.ticker,noteCount:input.noteIds.length}: {})}); await client.query("COMMIT"); return type === "note" ? noteMeta({...next,owner_name:"",owner_email:""}):ideaMeta({...next,owner_name:"",owner_email:"",note_ids:operation === "delete" ? []:input.noteIds,note_titles:[]});
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();} }
async function recordAccess(type,id,actor,input){const table=type === "note"?"research_notes":"research_ideas"; const r=(await pool.query(`SELECT * FROM ${table} WHERE id=$1 AND team_id=$2 AND deleted_at IS NULL`,[id,TEAM])).rows[0];if(!r)throw err(`${type.toUpperCase()}_NOT_FOUND`,404); if(!canReadRaw(actor,r))throw err("VIEW_FORBIDDEN",403);const internalAiAllowed=type==="note"?r.ai_processing_allowed:r.internal_ai_allowed;const webSearchAllowed=type==="note"?r.external_search_allowed:r.web_search_allowed;if(input.action==="download"&&!r.download_allowed)throw err("DOWNLOAD_FORBIDDEN",403);if(input.action==="ai_use"&&!internalAiAllowed)throw err("INTERNAL_AI_FORBIDDEN",403);if(input.externalAi===true&&!r.external_ai_allowed)throw err("EXTERNAL_AI_FORBIDDEN",403);if(input.externalSearch===true&&!webSearchAllowed)throw err("WEB_SEARCH_FORBIDDEN",403);const c=await pool.connect();try{await c.query("BEGIN");await audit(c,actor,type,id,input.action,r.version,r.version,{externalAi:input.externalAi===true,externalSearch:input.externalSearch===true,redactionRequired:r.redaction_required===true});await c.query("COMMIT");}catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}}

// AskAI gray-box retrieval contract. Raw records remain owner/manager-only,
// while any active team member may retrieve content explicitly approved for
// internal AI use. The blind index stores keyed hashes rather than plaintext.
async function retrievePrivateResearchForAskAi(clerkUserId, question, limit = 24) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 24, 50));
  const requester = (await pool.query(`SELECT u.id FROM research_users u JOIN research_team_memberships m ON m.user_id=u.id AND m.team_id=$2 AND m.status='active' WHERE u.clerk_user_id=$1 AND u.status='active'`, [clean(clerkUserId, 128), TEAM])).rows[0];
  if (!requester) return { records: [], requesterFound: false, indexMode: "blind-hash-lexical-v1" };
  const hashes = searchHashes(question);
  const candidates = (await pool.query(
    hashes.length
      ? `SELECT *, cardinality(ARRAY(SELECT unnest(term_hashes) INTERSECT SELECT unnest($1::text[]))) AS overlap FROM research_private_search_index WHERE term_hashes && $1::text[] ORDER BY overlap DESC,updated_at DESC LIMIT 100`
      : `SELECT *,0 AS overlap FROM research_private_search_index ORDER BY updated_at DESC LIMIT 100`,
    hashes.length ? [hashes] : [],
  )).rows;
  const records = [];
  for (const candidate of candidates) {
    if (records.length >= safeLimit) break;
    if (candidate.entity_type === "note" || candidate.entity_type === "idea") {
      const type = candidate.entity_type; const table = type === "note" ? "research_notes" : "research_ideas"; const allowed = type === "note" ? "ai_processing_allowed" : "internal_ai_allowed"; const prefix = type === "note" ? "body" : "thesis";
      const row = (await pool.query(`SELECT * FROM ${table} WHERE id=$1 AND team_id=$2 AND deleted_at IS NULL AND ${allowed}=true`, [candidate.entity_id, TEAM])).rows[0];
      if (!row) continue;
      records.push({ type, id: row.id, title: `[Private team ${type === "note" ? "Note" : "Idea"}]`, ticker: row.ticker || undefined, content: decrypted(prefix,row,type), sensitivityLevel: row.sensitivity_level, internalAiAllowed: true, externalAiAllowed: row.external_ai_allowed === true, redactionRequired: row.redaction_required === true, updatedAt: row.updated_at, score: Number(candidate.overlap || 0) });
      continue;
    }
    const row = (await pool.query(`SELECT a.*,e.*,CASE WHEN a.target_type='note' THEN n.ai_processing_allowed ELSE i.internal_ai_allowed END AS internal_ai_allowed,CASE WHEN a.target_type='note' THEN n.external_ai_allowed ELSE i.external_ai_allowed END AS external_ai_allowed,CASE WHEN a.target_type='note' THEN n.sensitivity_level ELSE i.sensitivity_level END AS sensitivity_level,CASE WHEN a.target_type='note' THEN n.redaction_required ELSE i.redaction_required END AS redaction_required FROM research_attachments a JOIN research_attachment_extractions e ON e.attachment_id=a.id LEFT JOIN research_notes n ON a.target_type='note' AND n.id=a.target_id AND n.deleted_at IS NULL LEFT JOIN research_ideas i ON a.target_type='idea' AND i.id=a.target_id AND i.deleted_at IS NULL WHERE a.id=$1 AND a.team_id=$2 AND a.deleted_at IS NULL`, [candidate.entity_id, TEAM])).rows[0];
    if (!row?.internal_ai_allowed) continue;
    records.push({ type: "attachment", id: row.id, title: "[Private team Attachment]", content: decryptText({ ciphertext_b64: row.text_ciphertext_b64, nonce_b64: row.text_nonce_b64, auth_tag_b64: row.text_auth_tag_b64, wrapped_data_key_b64: row.text_wrapped_data_key_b64, key_wrap_nonce_b64: row.text_key_wrap_nonce_b64, key_wrap_auth_tag_b64: row.text_key_wrap_auth_tag_b64, key_version: row.text_key_version }, cryptoContext, attachmentBinding(row.id)), sensitivityLevel: row.sensitivity_level, internalAiAllowed: true, externalAiAllowed: row.external_ai_allowed === true, redactionRequired: row.redaction_required === true, updatedAt: row.updated_at, score: Number(candidate.overlap || 0) });
  }
  return { records, requesterFound: true, indexMode: "blind-hash-lexical-v1" };
}
async function linkNote(ideaId,noteId,actor,remove=false){if(!validId(noteId))throw err("INVALID_NOTE_ID");const c=await pool.connect();try{await c.query("BEGIN");const idea=(await c.query(`SELECT * FROM research_ideas WHERE id=$1 AND team_id=$2 AND deleted_at IS NULL FOR UPDATE`,[ideaId,TEAM])).rows[0];if(!idea)throw err("IDEA_NOT_FOUND",404);if(!roleCanEdit(actor,idea))throw err("EDIT_FORBIDDEN",403);if(remove)await c.query(`UPDATE research_idea_note_links SET deleted_at=now() WHERE idea_id=$1 AND note_id=$2`,[ideaId,noteId]);else await reconcileIdeaNotes(c,ideaId,[...(await c.query(`SELECT note_id FROM research_idea_note_links WHERE idea_id=$1 AND deleted_at IS NULL`,[ideaId])).rows.map((row)=>row.note_id),noteId],actor);await audit(c,actor,"idea",ideaId,remove?"unlink":"link",idea.version,idea.version,{linkedEntity:"note"});await c.query("COMMIT");}catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}}

function isFrozenMutation(method, id, sub) {
  if (!ingestionFrozen) return false;
  if (method === "POST" && sub === "access") return false;
  return (!id && method === "POST")
    || (Boolean(id) && ["PATCH", "DELETE"].includes(method))
    || (Boolean(id) && sub === "notes" && ["POST", "DELETE"].includes(method));
}

async function handler(req,res){const url=new URL(req.url||"/",`http://${req.headers.host||"localhost"}`); if(url.pathname==="/health")return send(res,200,{ok:true,service:"notes",ingestionFrozen}); if(url.pathname==="/ready"){try{await pool.query("SELECT 1");return send(res,200,{ok:true,database:"ready",encryption:"ready",ingestionFrozen});}catch{return send(res,503,{ok:false,database:"unavailable"});}}
  if (url.pathname === "/v1/internal/askai/private-research") {
    try {
      if (req.method !== "POST") return send(res, 405, { error: "METHOD_NOT_ALLOWED" });
      if (!serviceTokenMatches(req.headers["x-level-grind-retrieval-token"])) throw err("RETRIEVAL_SERVICE_AUTH_REQUIRED", 401);
      const input = await readBody(req);
      if (!clean(input.clerkUserId, 128)) throw err("CLERK_USER_ID_REQUIRED");
      // Contract: this server-to-server route may return only records approved
      // for team AskAI processing. EdgeOne must reduce them to bounded,
      // question-relevant excerpts before provider use; raw-record visibility
      // is never granted to the requesting browser.
      return send(res, 200, { scope: "team_gray_box_internal_ai", modelUse: "governed_excerpt_only", rawRecordVisibility: "forbidden", ...await retrievePrivateResearchForAskAi(input.clerkUserId, clean(input.question, 4000), input.limit) });
    } catch (e) { return send(res, Number(e?.status || 500), { error: Number(e?.status || 500) >= 500 ? "RETRIEVAL_SERVICE_ERROR" : e.message }); }
  }
  const attachmentTargetMatch = url.pathname.match(/^\/v1\/(notes|ideas)\/([0-9a-f-]{36})\/attachments$/i);
  const attachmentMatch = url.pathname.match(/^\/v1\/attachments\/([0-9a-f-]{36})(?:\/(complete|status|retry))?$/i);
  if (attachmentTargetMatch || attachmentMatch) { const objectStore = requestObjectStore(req); try {
    const actor = await identity(req);
    if (attachmentTargetMatch) { const type = attachmentTargetMatch[1].toLowerCase().slice(0, -1); const targetId = attachmentTargetMatch[2]; if (req.method === "GET") return send(res, 200, { attachments: await listAttachments(type, targetId, actor), configured: objectStore.configured, ingestionFrozen }); if (req.method === "POST") { if (ingestionFrozen) return send(res, 503, { error: "INGESTION_FROZEN", configured: objectStore.configured, ingestionFrozen: true }); return send(res, 201, await initAttachment(type, targetId, actor, await readBody(req), objectStore)); } return send(res, 405, { error: "METHOD_NOT_ALLOWED" }); }
    const attachmentId = attachmentMatch[1]; const action = attachmentMatch[2] || "status";
    if (req.method === "GET" && action === "status") return send(res, 200, { attachment: await attachmentStatus(attachmentId, actor) });
    if (req.method === "POST" && action === "complete") { if (ingestionFrozen) return send(res, 503, { error: "INGESTION_FROZEN", configured: objectStore.configured, ingestionFrozen: true }); const file = objectStore.directUpload ? null : parseMultipartFile(req, await readRawBody(req)); return send(res, 200, { attachment: await completeAttachment(attachmentId, actor, file, objectStore) }); }
    if (req.method === "POST" && action === "retry") { if (ingestionFrozen) return send(res, 503, { error: "INGESTION_FROZEN", configured: objectStore.configured, ingestionFrozen: true }); return send(res, 200, { attachment: await retryAttachment(attachmentId, actor, objectStore) }); }
    if (req.method === "DELETE" && action === "status") { if (ingestionFrozen) return send(res, 503, { error: "INGESTION_FROZEN", configured: objectStore.configured, ingestionFrozen: true }); const input = await readBody(req); return send(res, 200, { attachment: await deleteAttachment(attachmentId, actor, input.expectedVersion, objectStore) }); }
    return send(res, 405, { error: "METHOD_NOT_ALLOWED" });
  } catch (e) { const status = Number(e?.status || 500); const payload = { error: status >= 500 ? "ATTACHMENT_SERVICE_ERROR" : e.message, configured: objectStore.configured, ingestionFrozen }; if (e.currentVersion) payload.currentVersion = e.currentVersion; return send(res, status, payload); } }
  if (url.pathname === "/v1/documents/parse") { try { if (req.method !== "POST") return send(res,405,{error:"METHOD_NOT_ALLOWED"}); if (localParserBypass) { if (!isLoopback(req)) throw err("LOCAL_PARSE_FORBIDDEN",403); } else await identity(req); const file=parseMultipartFile(req,await readRawBody(req)); if (file.bytes.length > 25 * 1024 * 1024) return send(res,413,{error:"FILE_TOO_LARGE"}); const document=await parseDocumentOnServer(file.filename,file.bytes); return send(res,200,{configured:true,ingestionFrozen,demo:localParserBypass,document}); } catch(e) { const status=Number(e?.status||500); return send(res,status,{error:status>=500?"DOCUMENT_SERVICE_ERROR":e.message,configured:true,ingestionFrozen,demo:localParserBypass}); } }
  const match=url.pathname.match(/^\/v1\/(notes|ideas)(?:\/([0-9a-f-]{36})(?:\/(access|notes))?)?$/i);if(!match)return send(res,404,{error:"NOT_FOUND"});try{const type=match[1].toLowerCase().slice(0,-1),id=match[2],sub=match[3],actor=await identity(req);if(isFrozenMutation(req.method,id,sub))return send(res,503,{error:"INGESTION_FROZEN",configured:true,ingestionFrozen:true,demo:false});if(!id&&req.method==="GET")return send(res,200,{configured:true,ingestionFrozen,demo:false,[match[1].toLowerCase()]:await listEntity(type,actor)});if(!id&&req.method==="POST")return send(res,200,{[type]:await createEntity(type,actor,normal(type,await readBody(req),"create"))});if(id&&req.method==="GET"&&!sub)return send(res,200,{[type]:await getEntity(type,id,actor)});if(id&&sub==="access"&&req.method==="POST"){await recordAccess(type,id,actor,await readBody(req));return send(res,204,{});}if(type==="idea"&&id&&sub==="notes"&&["POST","DELETE"].includes(req.method)){const input=await readBody(req);await linkNote(id,input.noteId,actor,req.method==="DELETE");return send(res,204,{});}if(id&&["PATCH","DELETE"].includes(req.method)){const op=req.method==="PATCH"?"update":"delete";return send(res,200,{[type]:await mutateEntity(type,actor,normal(type,await readBody(req),op),op)});}return send(res,405,{error:"METHOD_NOT_ALLOWED"});}catch(e){const status=Number(e?.status||500);const payload={error:status>=500?"NOTES_SERVICE_ERROR":e.message};if(e.currentVersion)payload.currentVersion=e.currentVersion;return send(res,status,payload);}}
await runAutoMigrations();
const server=createServer(handler);server.listen(port,"0.0.0.0",()=>console.log(`Level Grind Notes API listening on ${port}`));
async function shutdown(){server.close();await pool.end();}process.on("SIGTERM",shutdown);process.on("SIGINT",shutdown);
