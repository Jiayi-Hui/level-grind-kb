import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function safeFileName(name) {
  return String(name || "report.pdf")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

const root = path.resolve(process.argv[2] || "");
if (!process.argv[2]) {
  throw new Error("Usage: node scripts/materialize-backup-reports.mjs <backup-directory>");
}

const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
const corpusDocumentsTable = manifest.d1.tables.find((table) => table.name === "corpus_documents");
const corpusChunksTable = manifest.d1.tables.find((table) => table.name === "corpus_chunks");
if (!corpusDocumentsTable || !corpusChunksTable) {
  throw new Error("The backup does not contain corpus_documents and corpus_chunks.");
}

const documents = JSON.parse(
  await readFile(path.join(root, corpusDocumentsTable.path), "utf8"),
);
const chunks = JSON.parse(
  await readFile(path.join(root, corpusChunksTable.path), "utf8"),
);
const pdfDir = path.join(root, "reports", "pdfs");
const pageTextDir = path.join(root, "reports", "page-text");
await mkdir(pdfDir, { recursive: true });
await mkdir(pageTextDir, { recursive: true });

const reportManifest = {
  format: "level-grind-materialized-report-library",
  formatVersion: 1,
  generatedAt: new Date().toISOString(),
  reports: [],
};

for (const document of documents) {
  const fileName = safeFileName(document.file_name);
  let pdfBytes;
  if (String(document.file_key).startsWith("parts:")) {
    const prefix = String(document.file_key).slice("parts:".length);
    const partEntries = manifest.r2.objects
      .filter((object) => object.key.startsWith(prefix))
      .sort((a, b) => a.key.localeCompare(b.key));
    if (partEntries.length === 0) {
      throw new Error(`No R2 parts found for ${document.id}.`);
    }
    const parts = [];
    for (const part of partEntries) {
      parts.push(await readFile(path.join(root, part.path)));
    }
    pdfBytes = Buffer.concat(parts);
  } else {
    const object = manifest.r2.objects.find((candidate) => candidate.key === document.file_key);
    if (!object) throw new Error(`No R2 object found for ${document.id}.`);
    pdfBytes = await readFile(path.join(root, object.path));
  }

  if (pdfBytes.length !== document.file_size) {
    throw new Error(
      `PDF size mismatch for ${document.id}: expected ${document.file_size}, received ${pdfBytes.length}`,
    );
  }
  if (pdfBytes.subarray(0, 4).toString() !== "%PDF") {
    throw new Error(`Materialized file is not a PDF: ${document.id}`);
  }

  const pdfRelativePath = path.posix.join("reports", "pdfs", fileName);
  await writeFile(path.join(root, pdfRelativePath), pdfBytes);

  const pages = new Map();
  for (const chunk of chunks.filter((candidate) => candidate.document_id === document.id)) {
    const pageNumber = Number(chunk.page_number);
    const existing = pages.get(pageNumber) ?? [];
    existing.push(String(chunk.content ?? ""));
    pages.set(pageNumber, existing);
  }
  const pagePayload = {
    documentId: document.id,
    securityCode: document.security_code,
    companyName: document.company_name,
    title: document.title,
    documentType: document.document_type,
    publishedAt: document.published_at,
    sourceUrl: document.source_url,
    pageCount: document.page_count,
    pages: [...pages.entries()]
      .sort(([left], [right]) => left - right)
      .map(([pageNumber, content]) => ({
        pageNumber,
        content: content.join("\n\n"),
      })),
  };
  const pageBytes = Buffer.from(`${JSON.stringify(pagePayload, null, 2)}\n`);
  const pageRelativePath = path.posix.join(
    "reports",
    "page-text",
    `${document.id}.json`,
  );
  await writeFile(path.join(root, pageRelativePath), pageBytes);

  reportManifest.reports.push({
    id: document.id,
    securityCode: document.security_code,
    companyName: document.company_name,
    title: document.title,
    fileName,
    pdfPath: pdfRelativePath,
    pdfBytes: pdfBytes.length,
    pdfSha256: sha256(pdfBytes),
    pageTextPath: pageRelativePath,
    extractedPages: pagePayload.pages.length,
    pageTextBytes: pageBytes.length,
    pageTextSha256: sha256(pageBytes),
  });
}

reportManifest.reports.sort((a, b) =>
  `${a.securityCode}:${a.title}`.localeCompare(`${b.securityCode}:${b.title}`),
);
await writeFile(
  path.join(root, "reports", "manifest.json"),
  `${JSON.stringify(reportManifest, null, 2)}\n`,
);
console.log(
  `Materialized ${reportManifest.reports.length} PDFs and per-report page text under ${path.join(root, "reports")}.`,
);
