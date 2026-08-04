import { clerkIdentity } from "./_shared-auth.js";
import { nativeResearchRequest } from "./_edgeone-research-store.js";

const MAX_CONTROL_BODY_BYTES = 600_000;

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});

export function sharedGatewayError(error, method = "GET", resource = "notes") {
  const message = error instanceof Error ? error.message : "SHARED_RESEARCH_ERROR";
  if (message.startsWith("AUTH_")) return json({ error: "请重新登录后再试" }, 401);
  if (message.startsWith("INVALID_")) return json({ error: "请求标识不正确。", code: message }, 400);
  if (message === "CONTROL_BODY_JSON_REQUIRED") return json({ error: "共享研究网关仅接收 JSON 控制请求；文件必须使用后端签发的直传地址。", code: message }, 415);
  if (message === "CONTROL_BODY_TOO_LARGE") return json({ error: "控制请求过大；请不要经 EdgeOne 传输文件。", code: message }, 413);
  if (message === "CONTROL_BODY_INVALID_JSON") return json({ error: "控制请求不是有效 JSON。", code: message }, 400);
  if (message === "NOTES_SERVICE_NOT_CONFIGURED") {
    if (method === "GET" && resource === "notes") return json({ configured: false, ingestionFrozen: true, demo: false, notes: [] }, 200);
    if (method === "GET" && resource === "ideas") return json({ configured: false, ingestionFrozen: true, demo: false, ideas: [] }, 200);
    return json({ error: "腾讯共享研究服务尚未配置，当前不可读取或写入。", code: message, configured: false, ingestionFrozen: true, demo: false }, 503);
  }
  return json({ error: "共享研究服务暂时不可用。", code: message.slice(0, 120) }, 503);
}

function notesServiceUrl(env, resource = "notes", suffix = "") {
  const base = String(env.NOTES_SERVICE_BASE_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("NOTES_SERVICE_NOT_CONFIGURED");
  return `${base}/v1/${resource}${suffix}`;
}

async function jsonControlBody(request) {
  if (["GET", "HEAD"].includes(request.method)) return undefined;
  const contentType = String(request.headers.get("Content-Type") || "").toLowerCase();
  if (!contentType.startsWith("application/json")) throw new Error("CONTROL_BODY_JSON_REQUIRED");
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CONTROL_BODY_BYTES) throw new Error("CONTROL_BODY_TOO_LARGE");
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_CONTROL_BODY_BYTES) throw new Error("CONTROL_BODY_TOO_LARGE");
  try { JSON.parse(body || "{}"); } catch { throw new Error("CONTROL_BODY_INVALID_JSON"); }
  return body || "{}";
}

/**
 * Control-plane proxy only. It intentionally rejects multipart/octet-stream:
 * PDF, Excel and image bytes must be uploaded directly to COS with a signed
 * URL returned by the Notes service's attachment-init endpoint.
 */
export async function forwardResearchControlRequest(request, env, { suffix = "", resource = "notes", attachment = false } = {}) {
  if (String(env.EDGEONE_NATIVE_RESEARCH || "").toLowerCase() === "true") {
    return nativeResearchRequest(request, env, { suffix, resource, attachment });
  }
  const identity = await clerkIdentity(request, env);
  const token = request.headers.get("Authorization");
  const body = await jsonControlBody(request);
  const upstream = await fetch(notesServiceUrl(env, resource, suffix), {
    method: request.method,
    headers: {
      ...(token ? { Authorization: token } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      "X-Level-Grind-Request-Id": crypto.randomUUID(),
      // Display metadata only. The Tencent service must independently validate the Clerk token
      // and authorise active team membership.
      "X-Level-Grind-Subject": identity.subject,
    },
    body,
  });
  if (attachment && upstream.status === 404) {
    return json({ error: "附件直传服务尚未上线；未接收或保存文件。", code: "ATTACHMENT_SERVICE_UNAVAILABLE", configured: true }, 501);
  }
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function forwardNotesRequest(request, env, suffix = "", resource = "notes") {
  return forwardResearchControlRequest(request, env, { suffix, resource });
}

async function handle(request, env) {
  try { return await forwardNotesRequest(request, env); }
  catch (error) { return sharedGatewayError(error, request.method, "notes"); }
}

export async function onRequestGet({ request, env }) { return handle(request, env); }
export async function onRequestPost({ request, env }) { return handle(request, env); }
export async function onRequestPatch({ request, env }) { return handle(request, env); }
export async function onRequestDelete({ request, env }) { return handle(request, env); }
