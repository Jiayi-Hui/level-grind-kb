import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const manifestArg = process.argv.find((value) => value.startsWith("--manifest="));
const baseArg = process.argv.find((value) => value.startsWith("--base-url="));
const execute = args.has("--execute");
const manifestPath = resolve(manifestArg?.slice("--manifest=".length) || "research-import-manifest.json");
const baseUrl = (baseArg?.slice("--base-url=".length) || "https://www.level-grind.com").replace(/\/$/, "");
const token = process.env.LEVEL_GRIND_CLERK_TOKEN || "";

const mediaTypes = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".txt": "text/plain",
};

function stop(message) {
  console.error(message);
  process.exitCode = 1;
}

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: ${payload.error || response.status}`);
  return payload;
}

async function uploadAttachment(item, parentId) {
  const bytes = await readFile(item.path);
  const fileName = basename(item.path);
  const mediaType = mediaTypes[extname(fileName).toLowerCase()] || "application/octet-stream";
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const query = `parentType=${item.type}&parentId=${encodeURIComponent(parentId)}`;
  const initialized = await request(`/api/research-attachments?${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, mediaType, byteSize: bytes.byteLength, sha256 }),
  });
  if (!initialized.upload?.url) throw new Error(`${fileName}: no upload URL returned`);
  const uploaded = await fetch(initialized.upload.url, {
    method: initialized.upload.method || "PUT",
    headers: initialized.upload.headers || {},
    body: bytes,
  });
  if (!uploaded.ok) throw new Error(`${fileName}: COS upload failed (${uploaded.status})`);
  return request(`/api/research-attachments?${query}&attachmentId=${encodeURIComponent(initialized.attachment.id)}&action=complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

async function createParent(item) {
  const shared = {
    title: item.title || basename(item.path, extname(item.path)),
    sourceContributorEmail: item.sourceContributorEmail,
    sensitivityLevel: item.sensitivityLevel || "internal",
    viewAllowed: true,
    internalAiAllowed: true,
    externalAiAllowed: false,
    webSearchAllowed: false,
    downloadAllowed: false,
    redactionRequired: item.sensitivityLevel !== "public",
  };
  if (item.type === "note") {
    const payload = await request("/api/shared-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...shared, body: "", sourceKind: item.sourceKind || "uploaded_document", templateFields: item.templateFields || {} }),
    });
    return payload.note;
  }
  const payload = await request("/api/shared-ideas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...shared, ticker: "", thesis: "", direction: "watch", status: "draft", noteIds: [], templateFields: item.templateFields || {} }),
  });
  return payload.idea;
}

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
  stop(`Cannot read manifest: ${error.message}`);
}

if (!Array.isArray(manifest?.items) || !manifest.items.length) stop("Manifest must contain a non-empty items array.");
if (process.exitCode) process.exit();

const checked = [];
for (const item of manifest.items) {
  if (!["note", "idea"].includes(item.type)) stop(`Unsupported type: ${item.type}`);
  if (!item.path || !item.sourceContributorEmail) stop("Each item needs path and sourceContributorEmail.");
  const bytes = await readFile(item.path);
  checked.push({ type: item.type, title: item.title || basename(item.path), fileName: basename(item.path), bytes: bytes.byteLength, sensitivityLevel: item.sensitivityLevel || "internal" });
}
if (process.exitCode) process.exit();

if (!execute) {
  console.log(JSON.stringify({ mode: "dry-run", baseUrl, count: checked.length, items: checked }, null, 2));
  process.exit();
}
if (!token) stop("LEVEL_GRIND_CLERK_TOKEN is required for --execute.");
if (process.exitCode) process.exit();

const results = [];
for (const item of manifest.items) {
  try {
    const parent = await createParent(item);
    const completed = await uploadAttachment(item, parent.id);
    results.push({ ok: true, type: item.type, id: parent.id, fileName: basename(item.path), attachmentId: completed.attachment?.id, parseStatus: completed.attachment?.parseStatus, candidateCount: completed.attachment?.candidates?.length || 0 });
  } catch (error) {
    results.push({ ok: false, type: item.type, fileName: basename(item.path), error: error.message });
    break;
  }
}

const resultPath = `${manifestPath}.result.json`;
await writeFile(resultPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, results }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ resultPath, imported: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length }, null, 2));
