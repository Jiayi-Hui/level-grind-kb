#!/usr/bin/env node

/**
 * Signed-in staging smoke for the deployed EdgeOne SSE route.
 * Supply a short-lived existing Clerk session token through ASKAI_SMOKE_TOKEN;
 * this script intentionally logs only event names and elapsed timings.
 */
const endpoint = String(process.env.ASKAI_SMOKE_URL || "").trim();
const token = String(process.env.ASKAI_SMOKE_TOKEN || "").trim();
const provider = String(process.env.ASKAI_SMOKE_PROVIDER || "deepseek").trim().toLowerCase();
const model = String(process.env.ASKAI_SMOKE_MODEL || "").trim();
if (!endpoint || !token) {
  console.error("Set ASKAI_SMOKE_URL and ASKAI_SMOKE_TOKEN. The token is never printed.");
  process.exit(2);
}
if (!["deepseek", "openrouter"].includes(provider)) {
  console.error("ASKAI_SMOKE_PROVIDER must be deepseek or openrouter.");
  process.exit(2);
}
if (provider === "openrouter" && !model) {
  console.error("Set ASKAI_SMOKE_MODEL to one reviewed server-allowlisted OpenRouter model.");
  process.exit(2);
}

const startedAt = Date.now();
const response = await fetch(endpoint, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "text/event-stream" },
  body: JSON.stringify({
    question: "只回复 stream-ok。",
    scope: "events",
    mode: "context",
    thinkingEnabled: false,
    modelProvider: provider === "openrouter" ? "openrouter" : "default",
    ...(provider === "openrouter" ? { model } : {}),
    contextEntries: [],
    history: [],
  }),
});

if (!response.ok || !response.body || !String(response.headers.get("content-type") || "").includes("text/event-stream")) {
  console.error(`FAIL: AskAI SSE route returned HTTP ${response.status} instead of an event stream.`);
  process.exit(1);
}

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let firstEventAt = null;
let firstDeltaAt = null;
let finished = false;

while (!finished) {
  const { value, done } = await reader.read();
  buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replace(/\r\n/g, "\n");
  const frames = buffer.split("\n\n");
  buffer = frames.pop() || "";
  for (const frame of frames) {
    const event = frame.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
    if (!event) continue;
    if (!firstEventAt) firstEventAt = Date.now();
    if (event === "delta" && !firstDeltaAt) firstDeltaAt = Date.now();
    if (event === "done" || event === "error") finished = true;
  }
  if (done) break;
}

if (!firstEventAt || !firstDeltaAt) {
  console.error("FAIL: stream ended without both an immediate event and a response delta.");
  process.exit(1);
}
console.log(JSON.stringify({
  status: "PASS",
  firstEventMs: firstEventAt - startedAt,
  firstDeltaMs: firstDeltaAt - startedAt,
  completedMs: Date.now() - startedAt,
  provider,
  ...(model ? { model } : {}),
}));
