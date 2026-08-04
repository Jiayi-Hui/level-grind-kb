import { createServer } from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { createClerkClient, verifyToken } from "@clerk/backend";
import pg from "pg";
import { decryptText, encryptText, loadCryptoContext } from "./crypto-envelope.mjs";
import { attachmentObjectKey, createObjectStore } from "./object-store.mjs";

const { Pool } = pg;
const TEAM = "level-grind";
const port = Number(process.env.PORT || 8080);
const databaseUrl = process.env.DATABASE_URL || "";
const clerkSecretKey = process.env.CLERK_SECRET_KEY || "";
if (!databaseUrl || !clerkSecretKey) throw new Error("DATABASE_URL and CLERK_SECRET_KEY are required");
const cryptoContext = loadCryptoContext(); // fail closed before accepting traffic
const pool = new Pool({ connectionString: databaseUrl, max: Number(process.env.PG_POOL_MAX || 8), ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } });
const clerk = createClerkClient({ secretKey: clerkSecretKey });
const authorizedParties = (process.env.CLERK_AUTHORIZED_PARTIES || "https://www.level-grind.com,https://level-grind.com").split(",").map((x) => x.trim()).filter(Boolean);
const managers = new Set([process.env.LEVEL_GRIND_OWNER_EMAIL, ...(process.env.LEVEL_GRIND_MEMBER_MANAGER_EMAILS || "").split(",")].map((x) => String(x || "").trim().toLowerCase()).filter(Boolean));
const invited = new Set([...managers, ...(process.env.LEVEL_GRIND_INVITED_EMAILS || "").split(",")].map((x) => String(x || "").trim().toLowerCase()).filter(Boolean));
const managersRoles = new Set(["Owner", "Admin", "PM", "GEM PM"]);
const ingestionFrozen = process.env.NOTES_INGESTION_ENABLED !== "true";
const localParserBypass = process.env.NODE_ENV !== "production" && process.env.NOTES_PARSER_LOCAL_DEV_BYPASS === "true";
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
function isLoopback(request) { const address=String(request.socket?.remoteAddress || ""); return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1"; }
async function readBody(req) { const parts = []; let size = 0; for await (const part of req) { size += part.length; if (size > 600_000) throw err("PAYLOAD_TOO_LARGE", 413); parts.push(part); } if (!parts.length) return {}; try { return JSON.parse(Buffer.concat(parts).toString("utf8")); } catch { throw err("INVALID_JSON"); } }
async function readRawBody(req, limit = 25 * 1024 * 1024 + 64 * 1024) { const chunks=[]; let size=0; for await (const chunk of req) { size += chunk.length; if (size > limit) throw err("FILE_TOO_LARGE",413); chunks.push(chunk); } return Buffer.concat(chunks); }
function binding(type, id) { return { teamId: TEAM, recordType: type, recordId: id }; }
function encrypted(prefix, value, type, id) { const e = encryptText(value, cryptoContext, binding(type, id)); return { [`${prefix}_ciphertext_b64`]: e.ciphertext_b64, [`${prefix}_nonce_b64`]: e.nonce_b64, [`${prefix}_auth_tag_b64`]: e.auth_tag_b64, [`${prefix}_wrapped_data_key_b64`]: e.wrapped_data_key_b64, [`${prefix}_key_wrap_nonce_b64`]: e.key_wrap_nonce_b64, [`${prefix}_key_wrap_auth_tag_b64`]: e.key_wrap_auth_tag_b64, [`${prefix}_key_version`]: e.key_version }; }
function decrypted(prefix, row, type) { return decryptText({ ciphertext_b64: row[`${prefix}_ciphertext_b64`], nonce_b64: row[`${prefix}_nonce_b64`], auth_tag_b64: row[`${prefix}_auth_tag_b64`], wrapped_data_key_b64: row[`${prefix}_wrapped_data_key_b64`], key_wrap_nonce_b64: row[`${prefix}_key_wrap_nonce_b64`], key_wrap_auth_tag_b64: row[`${prefix}_key_wrap_auth_tag_b64`], key_version: row[`${prefix}_key_version`] }, cryptoContext, binding(type, row.id)); }
function roleCanReview(actor) { return managersRoles.has(actor.role); }
function roleCanEdit(actor, row) { return roleCanReview(actor) || row.owner_user_id === actor.id; }

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
  if (extraction) result.extraction = { status: row.parse_status, pageCount: extraction.page_count, paragraphCount: extraction.paragraph_count, warnings: extraction.warnings || [], text: decryptText({ ciphertext_b64: extraction.text_ciphertext_b64, nonce_b64: extraction.text_nonce_b64, auth_tag_b64: extraction.text_auth_tag_b64, wrapped_data_key_b64: extraction.text_wrapped_data_key_b64, key_wrap_nonce_b64: extraction.text_key_wrap_nonce_b64, key_wrap_auth_tag_b64: extraction.text_key_wrap_auth_tag_b64, key_version: extraction.text_key_version }, cryptoContext, attachmentBinding(row.id)) };
  return result;
}
async function attachmentTarget(client, type, id, actor, lock = false, requireEdit = true) {
  if (!validId(id) || !["note", "idea"].includes(type)) throw err("INVALID_ATTACHMENT_TARGET");
  const table = type === "note" ? "research_notes" : "research_ideas";
  const target = (await client.query(`SELECT * FROM ${table} WHERE id=$1 AND team_id=$2 AND deleted_at IS NULL${lock ? " FOR UPDATE" : ""}`, [id, TEAM])).rows[0];
  if (!target) throw err(`${type.toUpperCase()}_NOT_FOUND`, 404);
  if (!requireEdit && target.view_allowed === false && !roleCanEdit(actor, target)) throw err("VIEW_FORBIDDEN", 403);
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
  await client.query(`INSERT INTO research_attachment_extractions (attachment_id,text_ciphertext_b64,text_nonce_b64,text_auth_tag_b64,text_wrapped_data_key_b64,text_key_wrap_nonce_b64,text_key_wrap_auth_tag_b64,text_key_version,page_count,paragraph_count,warnings,extracted_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,now(),now()) ON CONFLICT (attachment_id) DO UPDATE SET text_ciphertext_b64=EXCLUDED.text_ciphertext_b64,text_nonce_b64=EXCLUDED.text_nonce_b64,text_auth_tag_b64=EXCLUDED.text_auth_tag_b64,text_wrapped_data_key_b64=EXCLUDED.text_wrapped_data_key_b64,text_key_wrap_nonce_b64=EXCLUDED.text_key_wrap_nonce_b64,text_key_wrap_auth_tag_b64=EXCLUDED.text_key_wrap_auth_tag_b64,text_key_version=EXCLUDED.text_key_version,page_count=EXCLUDED.page_count,paragraph_count=EXCLUDED.paragraph_count,warnings=EXCLUDED.warnings,extracted_at=now(),updated_at=now()`, [row.id,e.ciphertext_b64,e.nonce_b64,e.auth_tag_b64,e.wrapped_data_key_b64,e.key_wrap_nonce_b64,e.key_wrap_auth_tag_b64,e.key_version,document.pageCount || null,document.paragraphCount || null,JSON.stringify(document.warnings || [])]);
}
async function completeAttachment(attachmentId, actor, file, objectStore) {
  if (!objectStore.configured) throw err("OBJECT_STORE_NOT_CONFIGURED", 503); if (!objectStore.directUpload && (!file || file.bytes.length > 25 * 1024 * 1024)) throw err("FILE_TOO_LARGE", 413);
  const client = await pool.connect(); let row; let stored = false;
  try { await client.query("BEGIN"); row = await findAttachmentForEdit(client, attachmentId, actor, true); if (row.upload_status !== "initialized") throw err("ATTACHMENT_ALREADY_COMPLETED", 409); if (!objectStore.directUpload) { const digest = crypto.createHash("sha256").update(file.bytes).digest("hex"); if (file.filename !== row.file_name || file.bytes.length !== Number(row.byte_size) || digest !== row.sha256) throw err("ATTACHMENT_CONTENT_MISMATCH", 422); } await client.query(`UPDATE research_attachments SET upload_status='uploaded',parse_status='processing',version=version+1,updated_at=now() WHERE id=$1`, [row.id]); await client.query(`UPDATE research_background_jobs SET status='running',attempt_count=attempt_count+1,started_at=now() WHERE id IN (SELECT job_id FROM research_attachment_jobs WHERE attachment_id=$1 AND purpose='upload') AND status='queued'`, [row.id]); await client.query("COMMIT");
    let bytes; if (objectStore.directUpload) { const head = await objectStore.head(row.object_key); if (head.byteSize !== Number(row.byte_size) || head.sha256 !== row.sha256) throw err("ATTACHMENT_CONTENT_MISMATCH", 422); bytes = await objectStore.get(row.object_key); if (bytes.length !== Number(row.byte_size) || crypto.createHash("sha256").update(bytes).digest("hex") !== row.sha256) throw err("ATTACHMENT_CONTENT_MISMATCH", 422); } else { await objectStore.put(row.object_key, file.bytes); stored = true; bytes = file.bytes; } const document = await parseDocumentOnServer(row.file_name, bytes); const parseStatus = document.status === "ocr_required" ? "needs_review" : (document.status === "partial" ? "partial" : "ready");
    await client.query("BEGIN"); await saveAttachmentExtraction(client, row, document); const updated = (await client.query(`UPDATE research_attachments SET parse_status=$2,parse_error_code=NULL,version=version+1,updated_at=now() WHERE id=$1 RETURNING *`, [row.id, parseStatus])).rows[0]; await client.query(`UPDATE research_background_jobs SET status='succeeded',finished_at=now(),safe_result=$2::jsonb WHERE id IN (SELECT job_id FROM research_attachment_jobs WHERE attachment_id=$1) AND status IN ('queued','running')`, [row.id, JSON.stringify({ parseStatus, byteSize: Number(row.byte_size) })]); await audit(client, actor, "file", row.id, "upload_complete", row.version, updated.version, { parseStatus }); await audit(client, actor, "file", row.id, "parse", updated.version, updated.version, { parseStatus, warnings: (document.warnings || []).length }); await client.query("COMMIT"); return { ...attachmentMeta(updated), extraction: { status: parseStatus, pageCount: document.pageCount || null, paragraphCount: document.paragraphCount || null, warnings: document.warnings || [], text: document.text || "" } };
  } catch (error) { try { await client.query("ROLLBACK"); if (row) { await pool.query(`UPDATE research_attachments SET upload_status=CASE WHEN upload_status='initialized' THEN 'failed' ELSE upload_status END,parse_status='failed',parse_error_code=$2,version=version+1,updated_at=now() WHERE id=$1 AND deleted_at IS NULL`, [row.id, clean(error.message, 100)]); await pool.query(`UPDATE research_background_jobs SET status='failed',error_code=$2,finished_at=now() WHERE id IN (SELECT job_id FROM research_attachment_jobs WHERE attachment_id=$1) AND status IN ('queued','running')`, [row.id, clean(error.message, 100)]); } } catch {} if (stored && row) { try { await objectStore.remove(row.object_key); } catch {} } throw error; }
  finally { client.release(); }
}
async function attachmentStatus(attachmentId, actor) {
  const client = await pool.connect(); try { await client.query("BEGIN"); const row = await findAttachmentForRead(client, attachmentId, actor); const extraction = (await client.query(`SELECT * FROM research_attachment_extractions WHERE attachment_id=$1`, [row.id])).rows[0]; await audit(client, actor, "file", row.id, "view", row.version, row.version, { surface: "attachment_status" }); await client.query("COMMIT"); return attachmentWithExtraction(row, extraction); }
  catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
async function retryAttachment(attachmentId, actor, objectStore) {
  if (!objectStore.configured) throw err("OBJECT_STORE_NOT_CONFIGURED", 503); const client = await pool.connect(); let row; let jobId;
  try { await client.query("BEGIN"); row = await findAttachmentForEdit(client, attachmentId, actor, true); if (row.upload_status !== "uploaded") throw err("ATTACHMENT_NOT_UPLOADED", 409); await client.query(`UPDATE research_attachments SET parse_status='processing',parse_error_code=NULL,version=version+1,updated_at=now() WHERE id=$1`, [row.id]); jobId = await createAttachmentJob(client, actor, row.id, "retry", "running"); await audit(client, actor, "file", row.id, "retry", row.version, row.version + 1, { jobId }); await client.query("COMMIT"); const document = await parseDocumentOnServer(row.file_name, await objectStore.get(row.object_key)); const parseStatus = document.status === "ocr_required" ? "needs_review" : (document.status === "partial" ? "partial" : "ready"); await client.query("BEGIN"); await saveAttachmentExtraction(client, row, document); const updated = (await client.query(`UPDATE research_attachments SET parse_status=$2,version=version+1,updated_at=now() WHERE id=$1 RETURNING *`, [row.id, parseStatus])).rows[0]; await client.query(`UPDATE research_background_jobs SET status='succeeded',finished_at=now(),safe_result=$2::jsonb WHERE id=$1`, [jobId, JSON.stringify({ parseStatus })]); await audit(client, actor, "file", row.id, "parse", updated.version, updated.version, { retry: true, parseStatus }); await client.query("COMMIT"); return attachmentMeta(updated); }
  catch (error) { try { await client.query("ROLLBACK"); if (row) await pool.query(`UPDATE research_attachments SET parse_status='failed',parse_error_code=$2,version=version+1,updated_at=now() WHERE id=$1 AND deleted_at IS NULL`, [row.id, clean(error.message, 100)]); if (jobId) await pool.query(`UPDATE research_background_jobs SET status='failed',error_code=$2,finished_at=now() WHERE id=$1`, [jobId, clean(error.message, 100)]); } catch {} throw error; } finally { client.release(); }
}
async function deleteAttachment(attachmentId, actor, expectedVersion, objectStore) {
  const client = await pool.connect(); let row;
  try { await client.query("BEGIN"); row = await findAttachmentForEdit(client, attachmentId, actor, true); if (Number(expectedVersion) !== row.version) throw err("VERSION_CONFLICT", 409, { currentVersion: row.version }); const updated = (await client.query(`UPDATE research_attachments SET deleted_at=now(),deleted_by_user_id=$2,version=version+1,updated_at=now() WHERE id=$1 RETURNING *`, [row.id, actor.id])).rows[0]; await audit(client, actor, "file", row.id, "soft_delete", row.version, updated.version, {}); await client.query("COMMIT"); if (objectStore.configured) await objectStore.remove(row.object_key); return attachmentMeta(updated); }
  catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function identity(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, ""); if (!token) throw err("SIGN_IN_REQUIRED", 401);
  const jwt = await verifyToken(token, { ...(process.env.CLERK_JWT_KEY ? { jwtKey: process.env.CLERK_JWT_KEY } : { secretKey: clerkSecretKey }), authorizedParties });
  const clerkUser = await clerk.users.getUser(jwt.sub); const email = (clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress || "").trim().toLowerCase();
  if (!email || clerkUser.banned || clerkUser.locked || !invited.has(email)) throw err("TEAM_ACCESS_REQUIRED", 403);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = (await client.query(`INSERT INTO research_users (clerk_user_id,email,display_name,status) VALUES ($1,$2,$3,'active') ON CONFLICT (clerk_user_id) DO UPDATE SET email=EXCLUDED.email,display_name=EXCLUDED.display_name,updated_at=now() RETURNING *`, [jwt.sub, email, clerkUser.fullName || clerkUser.firstName || email.split("@")[0]])).rows[0];
    let membership = (await client.query(`SELECT * FROM research_team_memberships WHERE team_id=$1 AND user_id=$2 FOR UPDATE`, [TEAM, user.id])).rows[0];
    if (!membership) membership = (await client.query(`INSERT INTO research_team_memberships (team_id,user_id,role,status) VALUES ($1,$2,$3,'active') RETURNING *`, [TEAM, user.id, managers.has(email) ? "Owner" : "Analyst"])).rows[0];
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
function noteMeta(row) { return { id: row.id, title: row.title, sourceKind: row.source_kind, templateFields: row.template_fields || {}, ...policyMeta(row, "note"), version: row.version, createdAt: row.created_at, updatedAt: row.updated_at, owner: { display_name: row.owner_name, email: row.owner_email } }; }
function ideaMeta(row) { return { id: row.id, title: row.title, ticker: row.ticker, direction: row.direction, status: row.status, templateFields: row.template_fields || {}, ...policyMeta(row, "idea"), noteIds: row.note_ids || [], noteTitles: row.note_titles || [], version: row.version, createdAt: row.created_at, updatedAt: row.updated_at, owner: { display_name: row.owner_name, email: row.owner_email } }; }
async function listEntity(type, actor) {
  const table = type === "note" ? "research_notes" : "research_ideas";
  const ideaLinks = type === "idea" ? `, COALESCE((SELECT array_agg(l.note_id ORDER BY l.created_at) FROM research_idea_note_links l JOIN research_notes n ON n.id=l.note_id WHERE l.idea_id=x.id AND l.deleted_at IS NULL AND n.deleted_at IS NULL), ARRAY[]::uuid[]) AS note_ids, COALESCE((SELECT array_agg(n.title ORDER BY l.created_at) FROM research_idea_note_links l JOIN research_notes n ON n.id=l.note_id WHERE l.idea_id=x.id AND l.deleted_at IS NULL AND n.deleted_at IS NULL), ARRAY[]::text[]) AS note_titles` : "";
  const result = await pool.query(`SELECT x.*,u.display_name owner_name,u.email owner_email ${ideaLinks} FROM ${table} x JOIN research_users u ON u.id=x.owner_user_id WHERE x.team_id=$1 AND x.deleted_at IS NULL ORDER BY x.updated_at DESC LIMIT 250`, [TEAM]);
  if (result.rows.length) {
    const client = await pool.connect();
    try { await client.query("BEGIN"); for (const row of result.rows) await audit(client, actor, type, row.id, "view", row.version, row.version, { surface: "list_metadata" }); await client.query("COMMIT"); }
    catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  return result.rows.filter((row) => row.view_allowed !== false || roleCanEdit(actor, row)).map(type === "note" ? noteMeta : ideaMeta);
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
function normal(type, raw, operation) {
  const id = operation === "create" ? crypto.randomUUID() : clean(raw.id, 36); if (!validId(id)) throw err("INVALID_ID");
  const title = clean(raw.title); const text = String(raw[type === "note" ? "body" : "thesis"] || "").replace(/\u0000/g, ""); const expectedVersion = Number(raw.expectedVersion);
  if (operation !== "delete" && (!title || !text)) throw err("TITLE_AND_CONTENT_REQUIRED"); if (text.length > 500_000) throw err("CONTENT_TOO_LARGE", 413);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0 || (operation === "create" && expectedVersion !== 0)) throw err("INVALID_VERSION");
  const policy = { sensitivityLevel: ["public","internal","confidential","restricted"].includes(raw.sensitivityLevel) ? raw.sensitivityLevel : "internal", viewAllowed: raw.viewAllowed !== false, internalAiAllowed: raw.internalAiAllowed === true || raw.aiProcessingAllowed === true, externalAiAllowed: raw.externalAiAllowed === true, webSearchAllowed: raw.webSearchAllowed === true || raw.externalSearchAllowed === true, downloadAllowed: raw.downloadAllowed === true, redactionRequired: raw.redactionRequired === true };
  if (type === "note") return { id, title, text, expectedVersion, sourceKind: clean(raw.sourceKind || "manual_note", 80).replace(/[^a-z0-9_-]/gi, "_") || "manual_note", templateFields: templateFields(raw.templateFields), ...policy };
  const noteIds = Array.isArray(raw.noteIds) ? [...new Set(raw.noteIds.map((noteId) => clean(noteId, 36)))].filter(validId) : [];
  if (Array.isArray(raw.noteIds) && noteIds.length !== raw.noteIds.length) throw err("INVALID_NOTE_IDS");
  return { id, title, text, expectedVersion, ticker: clean(raw.ticker, 32).toUpperCase(), noteIds, direction: ["long","short","watch"].includes(raw.direction) ? raw.direction : "watch", status: ["draft","pending_review","approved","rejected","archived"].includes(raw.status) ? raw.status : "draft", templateFields: templateFields(raw.templateFields), ...policy };
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
    if (type === "note") { const e=encrypted("body",input.text,type,input.id); const r=(await client.query(`INSERT INTO research_notes (id,team_id,owner_user_id,title,body_ciphertext_b64,body_nonce_b64,body_auth_tag_b64,body_wrapped_data_key_b64,body_key_wrap_nonce_b64,body_key_wrap_auth_tag_b64,body_key_version,source_kind,sensitivity_level,template_fields,view_allowed,ai_processing_allowed,external_ai_allowed,external_search_allowed,download_allowed,redaction_required) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20) RETURNING *`, [input.id,TEAM,actor.id,input.title,e.body_ciphertext_b64,e.body_nonce_b64,e.body_auth_tag_b64,e.body_wrapped_data_key_b64,e.body_key_wrap_nonce_b64,e.body_key_wrap_auth_tag_b64,e.body_key_version,input.sourceKind,input.sensitivityLevel,JSON.stringify(input.templateFields),input.viewAllowed,input.internalAiAllowed,input.externalAiAllowed,input.webSearchAllowed,input.downloadAllowed,input.redactionRequired])).rows[0]; await audit(client,actor,type,r.id,"create",null,1,{sourceKind:input.sourceKind,sensitivityLevel:input.sensitivityLevel,redactionRequired:input.redactionRequired}); await client.query("COMMIT"); return {...noteMeta({...r,owner_name:actor.name,owner_email:actor.email})}; }
    if (!["draft", "pending_review"].includes(input.status) && !roleCanReview(actor)) throw err("IDEA_REVIEW_FORBIDDEN", 403);
    const e=encrypted("thesis",input.text,type,input.id); const r=(await client.query(`INSERT INTO research_ideas (id,team_id,owner_user_id,title,ticker,direction,status,thesis_ciphertext_b64,thesis_nonce_b64,thesis_auth_tag_b64,thesis_wrapped_data_key_b64,thesis_key_wrap_nonce_b64,thesis_key_wrap_auth_tag_b64,thesis_key_version,template_fields,sensitivity_level,view_allowed,internal_ai_allowed,external_ai_allowed,web_search_allowed,download_allowed,redaction_required) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18,$19,$20,$21,$22) RETURNING *`, [input.id,TEAM,actor.id,input.title,input.ticker,input.direction,input.status,e.thesis_ciphertext_b64,e.thesis_nonce_b64,e.thesis_auth_tag_b64,e.thesis_wrapped_data_key_b64,e.thesis_key_wrap_nonce_b64,e.thesis_key_wrap_auth_tag_b64,e.thesis_key_version,JSON.stringify(input.templateFields),input.sensitivityLevel,input.viewAllowed,input.internalAiAllowed,input.externalAiAllowed,input.webSearchAllowed,input.downloadAllowed,input.redactionRequired])).rows[0]; await reconcileIdeaNotes(client,r.id,input.noteIds,actor); await audit(client,actor,type,r.id,"create",null,1,{ticker:input.ticker,direction:input.direction,status:input.status,noteCount:input.noteIds.length,sensitivityLevel:input.sensitivityLevel}); await client.query("COMMIT"); return ideaMeta({...r,owner_name:actor.name,owner_email:actor.email,note_ids:input.noteIds,note_titles:[]});
  } catch(e){await client.query("ROLLBACK");throw e;} finally{client.release();}
}
async function getEntity(type,id,actor) { const client=await pool.connect(); try { await client.query("BEGIN"); const table=type === "note" ? "research_notes":"research_ideas"; const ideaLinks=type === "idea" ? `, COALESCE((SELECT array_agg(l.note_id ORDER BY l.created_at) FROM research_idea_note_links l JOIN research_notes n ON n.id=l.note_id WHERE l.idea_id=x.id AND l.deleted_at IS NULL AND n.deleted_at IS NULL), ARRAY[]::uuid[]) AS note_ids, COALESCE((SELECT array_agg(n.title ORDER BY l.created_at) FROM research_idea_note_links l JOIN research_notes n ON n.id=l.note_id WHERE l.idea_id=x.id AND l.deleted_at IS NULL AND n.deleted_at IS NULL), ARRAY[]::text[]) AS note_titles` : ""; const row=(await client.query(`SELECT x.*,u.display_name owner_name,u.email owner_email ${ideaLinks} FROM ${table} x JOIN research_users u ON u.id=x.owner_user_id WHERE x.id=$1 AND x.team_id=$2 AND x.deleted_at IS NULL FOR UPDATE`,[id,TEAM])).rows[0]; if(!row) throw err(`${type.toUpperCase()}_NOT_FOUND`,404); if(row.view_allowed === false && !roleCanEdit(actor,row)) throw err("VIEW_FORBIDDEN",403); await audit(client,actor,type,id,"view",row.version,row.version,{surface:"detail"}); await client.query("COMMIT"); return {...(type === "note" ? noteMeta(row):ideaMeta(row)), [type === "note" ? "body":"thesis"]:decrypted(type === "note" ? "body":"thesis",row,type)}; } catch(e){await client.query("ROLLBACK");throw e;} finally{client.release();} }
async function mutateEntity(type,actor,input,operation) { const client=await pool.connect(); try { await client.query("BEGIN"); const table=type === "note"?"research_notes":"research_ideas"; const row=(await client.query(`SELECT * FROM ${table} WHERE id=$1 AND team_id=$2 AND deleted_at IS NULL FOR UPDATE`,[input.id,TEAM])).rows[0]; if(!row)throw err(`${type.toUpperCase()}_NOT_FOUND`,404); if(row.version!==input.expectedVersion)throw err("VERSION_CONFLICT",409,{currentVersion:row.version}); if(!roleCanEdit(actor,row))throw err("EDIT_FORBIDDEN",403); let next;
    if(operation === "delete") next=(await client.query(`UPDATE ${table} SET deleted_at=now(),deleted_by_user_id=$2,version=version+1,updated_at=now() WHERE id=$1 RETURNING *`,[input.id,actor.id])).rows[0];
    else if(type === "note") {const e=encrypted("body",input.text,type,input.id); next=(await client.query(`UPDATE research_notes SET title=$2,body_ciphertext_b64=$3,body_nonce_b64=$4,body_auth_tag_b64=$5,body_wrapped_data_key_b64=$6,body_key_wrap_nonce_b64=$7,body_key_wrap_auth_tag_b64=$8,body_key_version=$9,source_kind=$10,sensitivity_level=$11,template_fields=$12::jsonb,view_allowed=$13,ai_processing_allowed=$14,external_ai_allowed=$15,external_search_allowed=$16,download_allowed=$17,redaction_required=$18,version=version+1,updated_at=now() WHERE id=$1 RETURNING *`,[input.id,input.title,e.body_ciphertext_b64,e.body_nonce_b64,e.body_auth_tag_b64,e.body_wrapped_data_key_b64,e.body_key_wrap_nonce_b64,e.body_key_wrap_auth_tag_b64,e.body_key_version,input.sourceKind,input.sensitivityLevel,JSON.stringify(input.templateFields),input.viewAllowed,input.internalAiAllowed,input.externalAiAllowed,input.webSearchAllowed,input.downloadAllowed,input.redactionRequired])).rows[0];}
    else {if(input.status !== row.status && !["draft", "pending_review"].includes(input.status) && !roleCanReview(actor)) throw err("IDEA_REVIEW_FORBIDDEN",403); const e=encrypted("thesis",input.text,type,input.id); next=(await client.query(`UPDATE research_ideas SET title=$2,ticker=$3,direction=$4,status=$5,thesis_ciphertext_b64=$6,thesis_nonce_b64=$7,thesis_auth_tag_b64=$8,thesis_wrapped_data_key_b64=$9,thesis_key_wrap_nonce_b64=$10,thesis_key_wrap_auth_tag_b64=$11,thesis_key_version=$12,template_fields=$13::jsonb,sensitivity_level=$14,view_allowed=$15,internal_ai_allowed=$16,external_ai_allowed=$17,web_search_allowed=$18,download_allowed=$19,redaction_required=$20,version=version+1,updated_at=now() WHERE id=$1 RETURNING *`,[input.id,input.title,input.ticker,input.direction,input.status,e.thesis_ciphertext_b64,e.thesis_nonce_b64,e.thesis_auth_tag_b64,e.thesis_wrapped_data_key_b64,e.thesis_key_wrap_nonce_b64,e.thesis_key_wrap_auth_tag_b64,e.thesis_key_version,JSON.stringify(input.templateFields),input.sensitivityLevel,input.viewAllowed,input.internalAiAllowed,input.externalAiAllowed,input.webSearchAllowed,input.downloadAllowed,input.redactionRequired])).rows[0]; await reconcileIdeaNotes(client,input.id,input.noteIds,actor);}
    await audit(client,actor,type,input.id,operation === "delete" ? "soft_delete":"update",row.version,next.version,{...(type === "idea" && operation !== "delete" ? {ticker:input.ticker,noteCount:input.noteIds.length}: {})}); await client.query("COMMIT"); return type === "note" ? noteMeta({...next,owner_name:"",owner_email:""}):ideaMeta({...next,owner_name:"",owner_email:"",note_ids:operation === "delete" ? []:input.noteIds,note_titles:[]});
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();} }
async function recordAccess(type,id,actor,input){const table=type === "note"?"research_notes":"research_ideas"; const r=(await pool.query(`SELECT * FROM ${table} WHERE id=$1 AND team_id=$2 AND deleted_at IS NULL`,[id,TEAM])).rows[0];if(!r)throw err(`${type.toUpperCase()}_NOT_FOUND`,404); if(r.view_allowed === false&&!roleCanEdit(actor,r))throw err("VIEW_FORBIDDEN",403);const internalAiAllowed=type==="note"?r.ai_processing_allowed:r.internal_ai_allowed;const webSearchAllowed=type==="note"?r.external_search_allowed:r.web_search_allowed;if(input.action==="download"&&!r.download_allowed)throw err("DOWNLOAD_FORBIDDEN",403);if(input.action==="ai_use"&&!internalAiAllowed)throw err("INTERNAL_AI_FORBIDDEN",403);if(input.externalAi===true&&!r.external_ai_allowed)throw err("EXTERNAL_AI_FORBIDDEN",403);if(input.externalSearch===true&&!webSearchAllowed)throw err("WEB_SEARCH_FORBIDDEN",403);const c=await pool.connect();try{await c.query("BEGIN");await audit(c,actor,type,id,input.action,r.version,r.version,{externalAi:input.externalAi===true,externalSearch:input.externalSearch===true,redactionRequired:r.redaction_required===true});await c.query("COMMIT");}catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}}
async function linkNote(ideaId,noteId,actor,remove=false){if(!validId(noteId))throw err("INVALID_NOTE_ID");const c=await pool.connect();try{await c.query("BEGIN");const idea=(await c.query(`SELECT * FROM research_ideas WHERE id=$1 AND team_id=$2 AND deleted_at IS NULL FOR UPDATE`,[ideaId,TEAM])).rows[0];if(!idea)throw err("IDEA_NOT_FOUND",404);if(!roleCanEdit(actor,idea))throw err("EDIT_FORBIDDEN",403);if(remove)await c.query(`UPDATE research_idea_note_links SET deleted_at=now() WHERE idea_id=$1 AND note_id=$2`,[ideaId,noteId]);else await reconcileIdeaNotes(c,ideaId,[...(await c.query(`SELECT note_id FROM research_idea_note_links WHERE idea_id=$1 AND deleted_at IS NULL`,[ideaId])).rows.map((row)=>row.note_id),noteId],actor);await audit(c,actor,"idea",ideaId,remove?"unlink":"link",idea.version,idea.version,{linkedEntity:"note"});await c.query("COMMIT");}catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}}

function isFrozenMutation(method, id, sub) {
  if (!ingestionFrozen) return false;
  if (method === "POST" && sub === "access") return false;
  return (!id && method === "POST")
    || (Boolean(id) && ["PATCH", "DELETE"].includes(method))
    || (Boolean(id) && sub === "notes" && ["POST", "DELETE"].includes(method));
}

async function handler(req,res){const url=new URL(req.url||"/",`http://${req.headers.host||"localhost"}`); if(url.pathname==="/health")return send(res,200,{ok:true,service:"notes",ingestionFrozen}); if(url.pathname==="/ready"){try{await pool.query("SELECT 1");return send(res,200,{ok:true,database:"ready",encryption:"ready",ingestionFrozen});}catch{return send(res,503,{ok:false,database:"unavailable"});}}
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
const server=createServer(handler);server.listen(port,"0.0.0.0",()=>console.log(`Level Grind Notes API listening on ${port}`));
async function shutdown(){server.close();await pool.end();}process.on("SIGTERM",shutdown);process.on("SIGINT",shutdown);
