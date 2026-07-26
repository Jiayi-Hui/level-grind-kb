import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireCorpusBootstrap } from "../../../../../lib/corpus-bootstrap";
import { prepareCorpusDb } from "../../../../../lib/corpus";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const denied = await requireCorpusBootstrap(request);
  if (denied) return denied;
  await prepareCorpusDb();
  const body = await request.json() as {
    id?: string;
    prefix?: string;
    securityCode?: string;
    companyName?: string;
    title?: string;
    documentType?: string;
    publishedAt?: string;
    sourceUrl?: string;
    fileName?: string;
    fileSize?: number;
    pageCount?: number;
  };
  const id = String(body.id ?? "");
  const prefix = String(body.prefix ?? "");
  const code = String(body.securityCode ?? "").trim().slice(0, 20);
  const company = String(body.companyName ?? "").trim().slice(0, 180);
  const title = String(body.title ?? "").trim().slice(0, 240);
  const documentType = String(body.documentType ?? "annual-report").trim().slice(0, 60);
  const publishedAt = String(body.publishedAt ?? "").trim().slice(0, 40);
  const sourceUrl = String(body.sourceUrl ?? "").trim().slice(0, 2000);
  const fileName = String(body.fileName ?? "").trim().slice(0, 240);
  const fileSize = Number(body.fileSize ?? 0);
  const pageCount = Number(body.pageCount ?? 0);
  if (
    !/^[a-f0-9-]+$/.test(id) ||
    prefix !== `corpus/${code}/${id}/parts/` ||
    !company ||
    !title ||
    !publishedAt ||
    !sourceUrl ||
    !fileName ||
    fileSize <= 0 ||
    pageCount <= 0
  ) {
    return NextResponse.json({ error: "Invalid completion metadata." }, { status: 400 });
  }
  const listed = await env.FILES.list({ prefix });
  const parts = listed.objects.sort((left, right) => left.key.localeCompare(right.key));
  const totalBytes = parts.reduce((sum, part) => sum + part.size, 0);
  if (!parts.length || totalBytes !== fileSize) {
    return NextResponse.json(
      { error: `Uploaded parts total ${totalBytes} bytes; expected ${fileSize}.` },
      { status: 409 },
    );
  }
  const first = await env.FILES.get(parts[0].key, { range: { offset: 0, length: 4 } });
  if (!first || new TextDecoder().decode(await first.arrayBuffer()) !== "%PDF") {
    return NextResponse.json({ error: "Uploaded parts are not a PDF." }, { status: 400 });
  }
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO corpus_documents (
        id, security_code, company_name, title, document_type, published_at,
        source_url, file_key, file_name, file_size, page_count, uploaded_by, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'bootstrap-import', ?12)`,
    ).bind(
      id,
      code,
      company,
      title,
      documentType,
      publishedAt,
      sourceUrl,
      `parts:${prefix}`,
      fileName,
      fileSize,
      pageCount,
      now,
    ).run();
  } catch (error) {
    const existing = await env.DB.prepare(
      "SELECT id, page_count FROM corpus_documents WHERE source_url = ?1",
    ).bind(sourceUrl).first<{ id: string; page_count: number }>();
    if (existing) {
      return NextResponse.json({
        id: existing.id,
        pageCount: existing.page_count,
        alreadyImported: true,
      });
    }
    throw error;
  }
  return NextResponse.json({ id, pageCount, alreadyImported: false }, { status: 201 });
}
