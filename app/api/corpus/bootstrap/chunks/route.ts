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
    documentId?: string;
    pages?: Array<{ pageNumber?: number; content?: string }>;
  };
  const documentId = String(body.documentId ?? "");
  const pages = Array.isArray(body.pages) ? body.pages.slice(0, 12) : [];
  const document = await env.DB.prepare(
    "SELECT id FROM corpus_documents WHERE id = ?1",
  ).bind(documentId).first();
  if (!document || !pages.length) {
    return NextResponse.json({ error: "Invalid document or page batch." }, { status: 400 });
  }
  const statements = pages.map((page) => {
    const pageNumber = Number(page.pageNumber ?? 0);
    const content = String(page.content ?? "").replace(/\u0000/g, "").trim().slice(0, 100000);
    if (!Number.isInteger(pageNumber) || pageNumber <= 0 || !content) {
      throw new Error("Invalid page.");
    }
    return env.DB.prepare(
      `INSERT INTO corpus_chunks (id, document_id, page_number, content)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(id) DO UPDATE SET content = excluded.content`,
    ).bind(`${documentId}:${pageNumber}`, documentId, pageNumber, content);
  });
  await env.DB.batch(statements);
  return NextResponse.json({ stored: statements.length });
}
