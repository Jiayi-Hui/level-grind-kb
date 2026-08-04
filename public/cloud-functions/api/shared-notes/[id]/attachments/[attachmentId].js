import { forwardResearchControlRequest, sharedGatewayError } from "../../../shared-notes.js";

function ids(params) {
  const noteId = String(params?.id || "");
  const attachmentId = String(params?.attachmentId || "");
  if (!/^[0-9a-f-]{36}$/i.test(noteId)) throw new Error("INVALID_NOTE_ID");
  if (!/^[0-9a-f-]{36}$/i.test(attachmentId)) throw new Error("INVALID_ATTACHMENT_ID");
  return { noteId, attachmentId };
}

export async function onRequest({ request, env, params }) {
  try {
    const { attachmentId } = ids(params);
    return await forwardResearchControlRequest(request, env, {
      resource: "attachments",
      suffix: `/${encodeURIComponent(attachmentId)}`,
      attachment: true,
    });
  } catch (error) {
    return sharedGatewayError(error, request.method, "attachments");
  }
}
