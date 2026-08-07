import { forwardIdeasRequest } from "../../shared-ideas.js";
import { routeParam, sharedGatewayError } from "../../shared-notes.js";
export async function onRequest({ request, env, params }) { try { return await forwardIdeasRequest(request, env, `/${encodeURIComponent(routeParam(request, params, "id", "shared-ideas"))}/access`); } catch (error) { return sharedGatewayError(error, request.method, "ideas"); } }
