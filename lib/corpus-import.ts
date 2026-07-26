import { env } from "cloudflare:workers";
import { extractText } from "unpdf";
import { prepareCorpusDb } from "./corpus";

export type CorpusImportMetadata = {
  securityCode: string;
  companyName: string;
  title: string;
  documentType: string;
  publishedAt: string;
  sourceUrl: string;
};

export class CorpusImportError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function importCorpusPdf(
  file: File,
  metadata: CorpusImportMetadata,
  uploadedBy: string,
) {
  await prepareCorpusDb();
  if (file.type !== "application/pdf") {
    throw new CorpusImportError("A PDF file is required.", 400);
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new CorpusImportError("PDF files must be 25 MB or smaller.", 400);
  }

  const code = metadata.securityCode.trim().slice(0, 20);
  const company = metadata.companyName.trim().slice(0, 180);
  const title = metadata.title.trim().slice(0, 240);
  const documentType = (metadata.documentType || "annual-report").trim().slice(0, 60);
  const publishedAt = metadata.publishedAt.trim().slice(0, 40);
  const sourceUrl = metadata.sourceUrl.trim().slice(0, 2000);
  if (!code || !company || !title || !publishedAt || !sourceUrl) {
    throw new CorpusImportError("Document metadata is incomplete.", 400);
  }

  const existing = await env.DB.prepare(
    "SELECT id, page_count FROM corpus_documents WHERE source_url = ?1",
  ).bind(sourceUrl).first<{ id: string; page_count: number }>();
  if (existing) {
    return {
      id: existing.id,
      pageCount: existing.page_count,
      searchablePages: existing.page_count,
      alreadyImported: true,
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 4)) !== "%PDF") {
    throw new CorpusImportError("The uploaded file is not a valid PDF.", 400);
  }
  const extracted = await extractText(bytes, { mergePages: false });
  const pages = (Array.isArray(extracted.text) ? extracted.text : [extracted.text])
    .map((content) => content.replace(/\u0000/g, "").trim())
    .filter(Boolean);
  if (!pages.length) {
    throw new CorpusImportError(
      "No searchable text could be extracted from this PDF.",
      422,
    );
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 180);
  const fileKey = `corpus/${code}/${id}/${safeName}`;
  await env.FILES.put(fileKey, bytes, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: { documentId: id, securityCode: code, uploadedBy },
  });
  try {
    await env.DB.prepare(
      `INSERT INTO corpus_documents (
        id, security_code, company_name, title, document_type, published_at,
        source_url, file_key, file_name, file_size, page_count, uploaded_by, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
    ).bind(
      id,
      code,
      company,
      title,
      documentType,
      publishedAt,
      sourceUrl,
      fileKey,
      file.name,
      file.size,
      extracted.totalPages,
      uploadedBy,
      now,
    ).run();
    for (let offset = 0; offset < pages.length; offset += 40) {
      const statements = pages.slice(offset, offset + 40).map((content, index) =>
        env.DB.prepare(
          "INSERT INTO corpus_chunks (id, document_id, page_number, content) VALUES (?1, ?2, ?3, ?4)",
        ).bind(crypto.randomUUID(), id, offset + index + 1, content.slice(0, 100000)),
      );
      await env.DB.batch(statements);
    }
  } catch (error) {
    await env.FILES.delete(fileKey);
    throw error;
  }

  return {
    id,
    pageCount: extracted.totalPages,
    searchablePages: pages.length,
    alreadyImported: false,
  };
}
