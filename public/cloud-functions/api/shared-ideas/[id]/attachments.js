import { forwardResearchControlRequest, sharedGatewayError } from "../../shared-notes.js";

function ideaId(params) {
  const id = String(params?.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("INVALID_IDEA_ID");
  return id;
}

export async function onRequest({ request, env, params }) {
  try {
    const id = ideaId(params);
    return await forwardResearchControlRequest(request, env, {
      resource: "ideas",
      suffix: `/${encodeURIComponent(id)}/attachments`,
      attachment: true,
    });
  } catch (error) {
    return sharedGatewayError(error, request.method, "attachments");
  }
}
