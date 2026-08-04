#!/usr/bin/env node

/**
 * No-secret local/preview routing diagnostic. It never makes a model request.
 */
const baseUrl = String(process.env.ASKAI_DIAGNOSTIC_URL || "http://127.0.0.1:4174").replace(/\/$/, "");
const endpoint = `${baseUrl}/api/agent-chat`;

try {
  const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("text/html")) {
    console.error(`FAIL: ${endpoint} returned HTML. This is a frontend fallback, not the AskAI function route.`);
    process.exitCode = 1;
  } else {
    const payload = await response.json().catch(() => null);
    console.log(JSON.stringify({
      endpoint,
      httpStatus: response.status,
      contentType,
      service: payload?.service || null,
      code: payload?.code || null,
      configuration: payload?.configuration || null,
    }));
    if (!response.ok) process.exitCode = 1;
  }
} catch (error) {
  console.error(`FAIL: cannot reach ${endpoint}: ${error instanceof Error ? error.message : "network error"}`);
  process.exitCode = 1;
}
