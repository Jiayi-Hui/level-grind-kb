#!/usr/bin/env node

const healthUrl = String(process.env.NOTES_SERVICE_HEALTH_URL || "").trim();
const readyUrl = String(process.env.NOTES_SERVICE_READY_URL || "").trim();
if (!healthUrl || !readyUrl) {
  console.error("Set NOTES_SERVICE_HEALTH_URL and NOTES_SERVICE_READY_URL, for example http://127.0.0.1:8080/health and http://127.0.0.1:8080/ready");
  process.exit(2);
}
for (const [name, url] of [["health", healthUrl], ["readiness", readyUrl]]) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    console.error(`Notes service ${name} check failed with HTTP ${response.status}.`);
    process.exit(1);
  }
  const payload = await response.json().catch(() => null);
  if (!payload?.ok || (name === "readiness" && (!payload.database || !payload.encryption))) {
    console.error(`Notes service ${name} response did not confirm the expected state.`);
    process.exit(1);
  }
}
console.log("PASS: Notes service liveness and database/encryption readiness are reachable.");
