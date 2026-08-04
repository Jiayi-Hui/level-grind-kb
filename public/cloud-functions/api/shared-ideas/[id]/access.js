import { forwardIdeasRequest } from "../../shared-ideas.js";
import { sharedGatewayError } from "../../shared-notes.js";
export async function onRequest({ request, env, params }) { try { return await forwardIdeasRequest(request, env, `/${encodeURIComponent(String(params?.id || ""))}/access`); } catch (error) { return sharedGatewayError(error, request.method, "ideas"); } }
