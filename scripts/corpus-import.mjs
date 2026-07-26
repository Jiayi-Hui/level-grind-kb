import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { extractText } from "unpdf";

const [manifestPath, siteUrl, limitArg] = process.argv.slice(2);
const importKey = process.env.CORPUS_IMPORT_KEY;
if (!manifestPath || !siteUrl || !importKey) {
  throw new Error(
    "Usage: CORPUS_IMPORT_KEY=... node scripts/corpus-import.mjs <manifest.json> <site-url> [limit]",
  );
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const records = Array.isArray(manifest.records) ? manifest.records : [];
const limit = limitArg ? Number(limitArg) : records.length;
const selected = records.slice(0, Number.isFinite(limit) ? limit : records.length);
const root = path.dirname(manifestPath);
const filesByName = new Map();

async function indexPdfs(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await indexPdfs(absolute);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
      filesByName.set(entry.name, absolute);
    }
  }
}

await indexPdfs(root);
let imported = 0;
for (const record of selected) {
  const filename = record.file?.filename;
  const pdfPath = filesByName.get(filename);
  if (!filename || !pdfPath) throw new Error(`Missing PDF for ${record.title}`);
  const bytes = await readFile(pdfPath);
  const extracted = await extractText(new Uint8Array(bytes), { mergePages: false });
  const pages = (Array.isArray(extracted.text) ? extracted.text : [extracted.text])
    .map((content, index) => ({
      pageNumber: index + 1,
      content: content.replace(/\u0000/g, "").trim(),
    }))
    .filter((page) => page.content);
  const metadata = {
    securityCode: record.code,
    companyName: record.company,
    title: record.title,
    documentType: record.documentType,
    publishedAt: record.publishedAt,
    sourceUrl: record.sourceUrl,
    fileName: filename,
    fileSize: bytes.length,
  };
  const initialized = await requestJson("/api/corpus/bootstrap/init", {
    method: "POST",
    body: JSON.stringify(metadata),
  });
  if (initialized.alreadyImported) {
    imported += 1;
    console.log(`${imported}/${selected.length} ${record.company} ${record.title} · already imported`);
    continue;
  }
  const partSize = 3_000_000;
  for (let offset = 0, partNumber = 0; offset < bytes.length; offset += partSize, partNumber += 1) {
    const part = bytes.subarray(offset, Math.min(offset + partSize, bytes.length));
    await requestJson("/api/corpus/bootstrap/part", {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-File-Prefix": initialized.prefix,
        "X-Part-Number": String(partNumber),
      },
      body: part,
    });
  }
  const completed = await requestJson("/api/corpus/bootstrap/complete", {
    method: "POST",
    body: JSON.stringify({
      ...metadata,
      id: initialized.id,
      prefix: initialized.prefix,
      pageCount: extracted.totalPages,
    }),
  });
  for (let offset = 0; offset < pages.length; offset += 12) {
    await requestJson("/api/corpus/bootstrap/chunks", {
      method: "POST",
      body: JSON.stringify({
        documentId: completed.id,
        pages: pages.slice(offset, offset + 12),
      }),
    });
  }
  imported += 1;
  console.log(
    `${imported}/${selected.length} ${record.company} ${record.title} · ${completed.pageCount} pages`,
  );
}

async function requestJson(route, options) {
  const response = await fetch(`${siteUrl.replace(/\/$/, "")}${route}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${importKey}`,
      ...(options.headers ?? {}),
      ...(typeof options.body === "string" ? { "Content-Type": "application/json" } : {}),
    },
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`${route}: ${response.status} ${text.slice(0, 200)}`);
  }
  if (!response.ok) {
    throw new Error(`${route}: ${payload.error || response.status}`);
  }
  return payload;
}
