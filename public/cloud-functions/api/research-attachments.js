import { forwardResearchControlRequest, sharedGatewayError } from "./shared-notes.js";

const UUID = /^[0-9a-f-]{36}$/i;

function requiredUuid(value, code) {
  const id = String(value || "").trim();
  if (!UUID.test(id)) throw new Error(code);
  return id;
}

// Static attachment gateway for EdgeOne direct-upload deployments. Some manual
// ZIP deployments do not reliably expose nested dynamic route parameters, so
// the browser sends identifiers as query parameters to this stable endpoint.
export async function onRequest({ request, env }) {
  try {
    const url = new URL(request.url);
    const parentType = url.searchParams.get("parentType") === "idea" ? "ideas" : "notes";
    const parentId = requiredUuid(url.searchParams.get("parentId"), parentType === "ideas" ? "INVALID_IDEA_ID" : "INVALID_NOTE_ID");
    const attachmentIdRaw = url.searchParams.get("attachmentId");
    const action = String(url.searchParams.get("action") || "").trim();

    if (!attachmentIdRaw) {
      return await forwardResearchControlRequest(request, env, {
        resource: parentType,
        suffix: `/${encodeURIComponent(parentId)}/attachments`,
        attachment: true,
      });
    }

    const attachmentId = requiredUuid(attachmentIdRaw, "INVALID_ATTACHMENT_ID");
    if (action && !["complete", "retry"].includes(action)) throw new Error("INVALID_ATTACHMENT_ACTION");
    return await forwardResearchControlRequest(request, env, {
      resource: "attachments",
      suffix: `/${encodeURIComponent(attachmentId)}${action ? `/${action}` : ""}`,
      attachment: true,
    });
  } catch (error) {
    return sharedGatewayError(error, request.method, "attachments");
  }
}
