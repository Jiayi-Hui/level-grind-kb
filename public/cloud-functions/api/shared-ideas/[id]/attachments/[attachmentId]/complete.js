import { forwardResearchControlRequest, routeParam, sharedGatewayError } from "../../../../shared-notes.js";

export async function onRequestPost({ request, env, params }) {
  try {
    const id = routeParam(request, params, "attachmentId", "attachments");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("INVALID_ATTACHMENT_ID");
    return await forwardResearchControlRequest(request, env, {
      resource: "attachments",
      suffix: `/${encodeURIComponent(id)}/complete`,
      attachment: true,
    });
  } catch (error) {
    return sharedGatewayError(error, request.method, "attachments");
  }
}
