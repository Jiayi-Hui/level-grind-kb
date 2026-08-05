import { nativeContributionRequest } from "./_edgeone-research-store.js";

export async function onRequest(context) {
  return nativeContributionRequest(context.request, context.env);
}
