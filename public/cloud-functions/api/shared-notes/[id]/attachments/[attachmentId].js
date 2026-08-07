import { forwardResearchControlRequest, routeParam, sharedGatewayError } from "../../../shared-notes.js";

function ids(request, params) {
  const noteId = routeParam(request, params, "id", "shared-notes");
  const attachmentId = routeParam(request, params, "attachmentId", "attachments");
  if (!/^[0-9a-f-]{36}$/i.test(noteId)) throw new Error("INVALID_NOTE_ID");
  if (!/^[0-9a-f-]{36}$/i.test(attachmentId)) throw new Error("INVALID_ATTACHMENT_ID");
  return { noteId, attachmentId };
}

export async function onRequest({ request, env, params }) {
  try {
    const { attachmentId } = ids(request, params);
    return await forwardResearchControlRequest(request, env, {
      resource: "attachments",
      suffix: `/${encodeURIComponent(attachmentId)}`,
      attachment: true,
    });
  } catch (error) {
    return sharedGatewayError(error, request.method, "attachments");
  }
}
