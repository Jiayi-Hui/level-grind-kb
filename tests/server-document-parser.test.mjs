import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";

const parser = new URL("../services/tencent-notes-api/document_parser.py", import.meta.url);

function runParser(filename, text) {
  const result = spawnSync("python3", [parser.pathname, filename], { input: text, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("server parser returns ephemeral TXT/MD content and never claims storage write", () => {
  const result = runParser("team-note.md", "# 标题\n\n正文");
  assert.equal(result.ok, true); assert.equal(result.document.temporary, true); assert.equal(result.document.storageWritten, false);
  assert.equal(result.document.kind, "md"); assert.match(result.document.text, /标题/);
});

test("server parser rejects unsupported document types before any storage path", () => {
  const result = runParser("model.xlsx", "not a document");
  assert.equal(result.ok, false); assert.equal(result.error, "UNSUPPORTED_FILE");
});

test("container parser stays backend-only while EdgeOne rejects file bytes", async () => {
  const [dockerfile, service, parserSource, gateway, route, attachments, complete, retry] = await Promise.all([
    readFile(new URL("../services/tencent-notes-api/Dockerfile", import.meta.url), "utf8"),
    readFile(new URL("../services/tencent-notes-api/server.mjs", import.meta.url), "utf8"),
    readFile(parser, "utf8"),
    readFile(new URL("../public/cloud-functions/api/shared-notes.js", import.meta.url), "utf8"),
    readFile(new URL("../public/cloud-functions/api/shared-notes/parse.js", import.meta.url), "utf8"),
    readFile(new URL("../public/cloud-functions/api/shared-notes/[id]/attachments.js", import.meta.url), "utf8"),
    readFile(new URL("../public/cloud-functions/api/shared-notes/[id]/attachments/[attachmentId]/complete.js", import.meta.url), "utf8"),
    readFile(new URL("../public/cloud-functions/api/shared-notes/[id]/attachments/[attachmentId]/retry.js", import.meta.url), "utf8"),
  ]);
  assert.match(dockerfile, /python3-pip/); assert.match(dockerfile, /requirements\.txt/);
  assert.match(parserSource, /from pypdf import PdfReader/); assert.match(parserSource, /from docx import Document/); assert.match(parserSource, /OCR_REQUIRED/);
  assert.match(service, /\/v1\/documents\/parse/); assert.match(service, /await identity\(req\)/); assert.match(service, /parseMultipartFile/); assert.match(service, /parseDocumentOnServer/);
  assert.match(service, /NODE_ENV !== "production"/); assert.match(service, /isLoopback/);
  assert.match(gateway, /CONTROL_BODY_JSON_REQUIRED/); assert.match(gateway, /directly to COS/); assert.doesNotMatch(gateway, /request\.arrayBuffer\(\)/);
  assert.match(route, /DOCUMENT_PARSE_REQUIRES_ATTACHMENT_PIPELINE/); assert.doesNotMatch(route, /forwardNotesRequest/);
  assert.match(attachments, /attachments/); assert.match(attachments, /attachment: true/);
  assert.match(complete, /\/complete/); assert.match(retry, /\/retry/);
});
