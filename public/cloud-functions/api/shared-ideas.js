import { forwardResearchControlRequest, sharedGatewayError } from "./shared-notes.js";

export async function forwardIdeasRequest(request, env, suffix = "") {
  return forwardResearchControlRequest(request, env, { suffix, resource: "ideas" });
}

async function handle(request, env) {
  try { return await forwardIdeasRequest(request, env); }
  catch (error) { return sharedGatewayError(error, request.method, "ideas"); }
}

export async function onRequestGet({ request, env }) { return handle(request, env); }
export async function onRequestPost({ request, env }) { return handle(request, env); }
export async function onRequestPatch({ request, env }) { return handle(request, env); }
export async function onRequestDelete({ request, env }) { return handle(request, env); }
