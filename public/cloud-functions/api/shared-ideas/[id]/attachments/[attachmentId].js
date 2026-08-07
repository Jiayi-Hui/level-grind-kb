import { forwardResearchControlRequest, routeParam, sharedGatewayError } from "../../../shared-notes.js";

function attachmentId(request, params) {
  const id = routeParam(request, params, "attachmentId", "attachments");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("INVALID_ATTACHMENT_ID");
  return id;
}

export async function onRequest({ request, env, params }) {
  try {
    return await forwardResearchControlRequest(request, env, {
      resource: "attachments",
      suffix: `/${encodeURIComponent(attachmentId(request, params))}`,
      attachment: true,
    });
  } catch (error) {
    return sharedGatewayError(error, request.method, "attachments");
  }
}
