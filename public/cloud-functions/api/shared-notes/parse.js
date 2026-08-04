import { clerkIdentity } from "../_shared-auth.js";
import { sharedGatewayError } from "../shared-notes.js";

const json = (value, status) => new Response(JSON.stringify(value), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});

// Kept as a compatibility route so an older browser gets an explicit state.
// EdgeOne must not receive a multipart upload: the replacement flow is
// attachment init -> browser direct COS PUT -> attachment complete -> worker.
export async function onRequestPost({ request, env }) {
  try {
    await clerkIdentity(request, env);
    return json({
      error: "文件解析已迁移到附件直传流程；当前后端附件服务尚未上线。",
      code: "DOCUMENT_PARSE_REQUIRES_ATTACHMENT_PIPELINE",
      configured: Boolean(String(env.NOTES_SERVICE_BASE_URL || "").trim()),
      ingestionFrozen: true,
    }, 503);
  } catch (error) {
    return sharedGatewayError(error, request.method, "attachments");
  }
}
