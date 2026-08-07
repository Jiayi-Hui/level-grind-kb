import { forwardResearchControlRequest, routeParam, sharedGatewayError } from "../../shared-notes.js";

function noteId(request, params) {
  const id = routeParam(request, params, "id", "shared-notes");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("INVALID_NOTE_ID");
  return id;
}

export async function onRequest({ request, env, params }) {
  try {
    const id = noteId(request, params);
    return await forwardResearchControlRequest(request, env, {
      resource: "notes",
      suffix: `/${encodeURIComponent(id)}/attachments`,
      attachment: true,
    });
  } catch (error) {
    return sharedGatewayError(error, request.method, "attachments");
  }
}
