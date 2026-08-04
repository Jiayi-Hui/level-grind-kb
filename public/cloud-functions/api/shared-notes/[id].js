import { forwardNotesRequest, sharedGatewayError } from "../shared-notes.js";

export async function onRequest({ request, env, params }) {
  const id = String(params?.id || "");
  try { return await forwardNotesRequest(request, env, `/${encodeURIComponent(id)}`); }
  catch (error) { return sharedGatewayError(error, request.method, "notes"); }
}
