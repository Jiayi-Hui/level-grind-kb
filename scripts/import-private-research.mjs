#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const [preparedDirectory = ".private-intake/2026-08-04-tiff/prepared"] = process.argv.slice(2);
const baseUrl = String(process.env.LEVEL_GRIND_BASE_URL || "https://www.level-grind.com").replace(/\/$/, "");
const token = process.env.CLERK_SESSION_TOKEN;
if (!token) throw new Error("CLERK_SESSION_TOKEN is required; never save it in a file or Git.");
const authHeaders = { Authorization: `Bearer ${token}` };
const api = async (path, init = {}) => {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { ...authHeaders, ...(init.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: ${payload.error || response.status}`);
  return payload;
};
const files = (await readdir(resolve(preparedDirectory))).filter((name) => name.endsWith(".json") && name !== "index.json").sort();
const existing = {
  note: (await api("/api/shared-notes")).notes || [],
  idea: (await api("/api/shared-ideas")).ideas || [],
};

for (const name of files) {
  const item = JSON.parse(await readFile(resolve(preparedDirectory, name), "utf8"));
  if (existing[item.resource].some((record) => record.title === item.title)) {
    console.log(`skip existing: ${item.title}`);
    continue;
  }
  const isNote = item.resource === "note";
  const endpoint = isNote ? "/api/shared-notes" : "/api/shared-ideas";
  const payload = {
    title: item.title,
    ...(isNote ? { body: item.body || "", sourceKind: item.sourceKind, templateFields: { meetingDate: item.id.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "", analyst: "BossX" } } : { thesis: "", ticker: "", status: "pending_review", direction: "watch", noteIds: [], templateFields: { analyst: "BossX", validationStatus: "unreviewed", trackingStatus: "not_tracking" } }),
    ...item.policy,
  };
  const created = await api(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const record = created[isNote ? "note" : "idea"];
  if (!/\.(txt|md|markdown)$/i.test(item.sourcePath)) {
    const bytes = await readFile(item.sourcePath);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const attachmentPath = `${endpoint}/${record.id}/attachments`;
    const initialized = await api(attachmentPath, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: item.sourceFile, mediaType: "application/pdf", byteSize: bytes.byteLength, sha256 }) });
    const uploaded = await fetch(initialized.upload.url, { method: initialized.upload.method || "PUT", headers: initialized.upload.headers || {}, body: bytes });
    if (!uploaded.ok) throw new Error(`${item.title}: attachment upload failed (${uploaded.status})`);
    await api(`${attachmentPath}/${initialized.attachment.id}/complete`, { method: "POST" });
  }
  console.log(`created ${item.resource}: ${item.title}`);
}
