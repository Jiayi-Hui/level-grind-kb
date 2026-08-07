import { forwardNotesRequest, routeParam, sharedGatewayError } from "../shared-notes.js";

export async function onRequest({ request, env, params }) {
  const id = routeParam(request, params, "id", "shared-notes");
  try { return await forwardNotesRequest(request, env, `/${encodeURIComponent(id)}`); }
  catch (error) { return sharedGatewayError(error, request.method, "notes"); }
}
