import { env } from "cloudflare:workers";
import { extractText } from "unpdf";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "../../../lib/access";
import { prepareCorpusDb } from "../../../lib/corpus";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  await prepareCorpusDb();
  const usageWhere = user.role === "owner" || user.role === "admin" ? "" : "WHERE user_email = ?1";
  const usageQuery = env.DB.prepare(
    `SELECT COUNT(*) AS query_count,
            COALESCE(SUM(input_tokens), 0) AS input_tokens,
            COALESCE(SUM(output_tokens), 0) AS output_tokens,
            COALESCE(SUM(CAST(estimated_cost_usd AS REAL)), 0) AS estimated_cost_usd
     FROM ai_usage_events ${usageWhere}`
  );
  const [documents, usage, memberUsage] = await Promise.all([
    env.DB.prepare(
      `SELECT id, security_code, company_name, title, document_type, published_at,
              source_url, file_name, file_size, page_count, created_at
       FROM corpus_documents ORDER BY published_at DESC, company_name`
    ).all(),
    (usageWhere ? usageQuery.bind(user.email) : usageQuery).first(),
    user.role === "owner" || user.role === "admin"
      ? env.DB.prepare(
          `SELECT user_email, COUNT(*) AS query_count,
                  COALESCE(SUM(input_tokens + output_tokens), 0) AS total_tokens,
                  COALESCE(SUM(CAST(estimated_cost_usd AS REAL)), 0) AS estimated_cost_usd
           FROM ai_usage_events GROUP BY user_email ORDER BY total_tokens DESC`
        ).all()
      : Promise.resolve({ results: [] }),
  ]);
  return NextResponse.json({
    documents: documents.results,
    usage: usage ?? { query_count: 0, input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 },
    memberUsage: memberUsage.results,
  });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  if (user.role !== "owner" && user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  await prepareCorpusDb();
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.type !== "application/pdf") {
    return NextResponse.json({ error: "A PDF file is required." }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "PDF files must be 25 MB or smaller." }, { status: 400 });
  }
  const code = String(form.get("securityCode") ?? "").trim().slice(0, 20);
  const company = String(form.get("companyName") ?? "").trim().slice(0, 180);
  const title = String(form.get("title") ?? file.name).trim().slice(0, 240);
  const documentType = String(form.get("documentType") ?? "annual-report").trim().slice(0, 60);
  const publishedAt = String(form.get("publishedAt") ?? "").trim().slice(0, 40);
  const sourceUrl = String(form.get("sourceUrl") ?? "").trim().slice(0, 2000);
  if (!code || !company || !title || !publishedAt || !sourceUrl) {
    return NextResponse.json({ error: "Document metadata is incomplete." }, { status: 400 });
  }
  const existing = await env.DB.prepare(
    "SELECT id, page_count FROM corpus_documents WHERE source_url = ?1"
  ).bind(sourceUrl).first<{ id: string; page_count: number }>();
  if (existing) {
    return NextResponse.json(
      { id: existing.id, pageCount: existing.page_count, alreadyImported: true },
      { status: 200 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 4)) !== "%PDF") {
    return NextResponse.json({ error: "The uploaded file is not a valid PDF." }, { status: 400 });
  }
  const extracted = await extractText(bytes, { mergePages: false });
  const pages = (Array.isArray(extracted.text) ? extracted.text : [extracted.text])
    .map((content) => content.replace(/\u0000/g, "").trim())
    .filter(Boolean);
  if (!pages.length) {
    return NextResponse.json({ error: "No searchable text could be extracted from this PDF." }, { status: 422 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 180);
  const fileKey = `corpus/${code}/${id}/${safeName}`;
  await env.FILES.put(fileKey, bytes, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: { documentId: id, securityCode: code, uploadedBy: user.email },
  });
  try {
    await env.DB.prepare(
      `INSERT INTO corpus_documents (
        id, security_code, company_name, title, document_type, published_at,
        source_url, file_key, file_name, file_size, page_count, uploaded_by, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`
    ).bind(
      id, code, company, title, documentType, publishedAt, sourceUrl,
      fileKey, file.name, file.size, extracted.totalPages, user.email, now
    ).run();
    for (let offset = 0; offset < pages.length; offset += 40) {
      const statements = pages.slice(offset, offset + 40).map((content, index) =>
        env.DB.prepare(
          "INSERT INTO corpus_chunks (id, document_id, page_number, content) VALUES (?1, ?2, ?3, ?4)"
        ).bind(crypto.randomUUID(), id, offset + index + 1, content.slice(0, 100000))
      );
      await env.DB.batch(statements);
    }
  } catch (error) {
    await env.FILES.delete(fileKey);
    throw error;
  }
  return NextResponse.json({ id, pageCount: extracted.totalPages, searchablePages: pages.length }, { status: 201 });
}
