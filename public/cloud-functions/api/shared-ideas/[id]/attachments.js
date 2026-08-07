import { forwardResearchControlRequest, routeParam, sharedGatewayError } from "../../shared-notes.js";

function ideaId(request, params) {
  const id = routeParam(request, params, "id", "shared-ideas");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("INVALID_IDEA_ID");
  return id;
}

export async function onRequest({ request, env, params }) {
  try {
    const id = ideaId(request, params);
    return await forwardResearchControlRequest(request, env, {
      resource: "ideas",
      suffix: `/${encodeURIComponent(id)}/attachments`,
      attachment: true,
    });
  } catch (error) {
    return sharedGatewayError(error, request.method, "attachments");
  }
}
