#!/usr/bin/env node

/**
 * Non-secret release guard for the direct-COS attachment architecture.
 * It never makes a network request, opens a database or prints a variable.
 */
import { readFile } from "node:fs/promises";

const strict = process.argv.includes("--strict");
const problems = [];
const required = ["CLERK_SECRET_KEY", "NOTES_SERVICE_BASE_URL"];
const missing = required.filter((name) => !String(process.env[name] || "").trim());
if (missing.length) problems.push(`Missing EdgeOne server variables: ${missing.join(", ")}`);

if (strict && String(process.env.NODE_ENV || "").toLowerCase() !== "production") {
  problems.push("NODE_ENV must be production for a production release check.");
}
for (const forbidden of ["COS_SECRET_ID", "COS_SECRET_KEY", "DATABASE_URL", "NOTES_MASTER_KEY_B64"]) {
  if (String(process.env[forbidden] || "").trim()) {
    problems.push(`${forbidden} must not be present in the EdgeOne attachment gateway runtime.`);
  }
}

const [gateway, parseRoute, attachmentRoute, completeRoute, retryRoute] = await Promise.all([
  readFile(new URL("../public/cloud-functions/api/shared-notes.js", import.meta.url), "utf8"),
  readFile(new URL("../public/cloud-functions/api/shared-notes/parse.js", import.meta.url), "utf8"),
  readFile(new URL("../public/cloud-functions/api/shared-notes/[id]/attachments.js", import.meta.url), "utf8"),
  readFile(new URL("../public/cloud-functions/api/shared-notes/[id]/attachments/[attachmentId]/complete.js", import.meta.url), "utf8"),
  readFile(new URL("../public/cloud-functions/api/shared-notes/[id]/attachments/[attachmentId]/retry.js", import.meta.url), "utf8"),
]).catch((error) => { problems.push(`Could not read attachment gateway source: ${error.message}`); return ["", "", "", "", ""]; });

if (!gateway.includes("CONTROL_BODY_JSON_REQUIRED") || gateway.includes("request.arrayBuffer()")) {
  problems.push("Attachment gateway is not JSON-control-only.");
}
if (!parseRoute.includes("DOCUMENT_PARSE_REQUIRES_ATTACHMENT_PIPELINE")) {
  problems.push("Legacy multipart parse route is not explicitly disabled.");
}
for (const [name, source, token] of [["init/list", attachmentRoute, "attachments"], ["complete", completeRoute, "/complete"], ["retry", retryRoute, "/retry"]]) {
  if (!source.includes(token)) problems.push(`Attachment ${name} route is missing.`);
}

if (problems.length) {
  for (const problem of problems) console.error(`FAIL: ${problem}`);
  process.exitCode = 1;
} else {
  console.log("PASS: EdgeOne attachment gateway has only the direct-COS control-plane contract.");
}
