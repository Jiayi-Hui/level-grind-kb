import assert from "node:assert/strict";
import test from "node:test";
import { providerStreamReader } from "../public/cloud-functions/api/_provider-stream.js";

test("provider stream has one direct reader and does not tee an unused clone", async () => {
  const response = new Response("data: {\"ok\":true}\n\ndata: [DONE]\n\n");
  const reader = providerStreamReader(response);
  const first = await reader.read();

  assert.equal(first.done, false);
  assert.throws(() => response.clone(), /unusable|already|clone/i);
  assert.throws(
    () => providerStreamReader(response),
    (error) => error.code === "PROVIDER_STREAM_UNREADABLE" && /自动切换兼容模式/.test(error.message),
  );
});

test("an already-consumed provider body maps to an actionable streaming error", async () => {
  const response = new Response("already consumed");
  await response.text();

  assert.throws(
    () => providerStreamReader(response),
    (error) => error.code === "PROVIDER_STREAM_UNREADABLE" && /自动切换兼容模式/.test(error.message),
  );
});
