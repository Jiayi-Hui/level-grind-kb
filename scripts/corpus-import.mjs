import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

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
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "application/pdf" }), filename);
  form.append("securityCode", record.code);
  form.append("companyName", record.company);
  form.append("title", record.title);
  form.append("documentType", record.documentType);
  form.append("publishedAt", record.publishedAt);
  form.append("sourceUrl", record.sourceUrl);
  const response = await fetch(
    `${siteUrl.replace(/\/$/, "")}/api/corpus/bootstrap`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${importKey}` },
      body: form,
    },
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${record.code} ${record.title}: ${payload.error || response.status}`);
  }
  imported += 1;
  console.log(
    `${imported}/${selected.length} ${record.company} ${record.title} · ${payload.pageCount} pages`,
  );
}
