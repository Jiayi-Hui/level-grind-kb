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
    securityCode?: string;
    companyName?: string;
    title?: string;
    documentType?: string;
    publishedAt?: string;
    sourceUrl?: string;
    fileName?: string;
    fileSize?: number;
  };
  const code = String(body.securityCode ?? "").trim().slice(0, 20);
  const sourceUrl = String(body.sourceUrl ?? "").trim().slice(0, 2000);
  const fileName = String(body.fileName ?? "").trim().slice(0, 240);
  const fileSize = Number(body.fileSize ?? 0);
  if (!code || !sourceUrl || !fileName || fileSize <= 0 || fileSize > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "Invalid import metadata." }, { status: 400 });
  }
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
  const id = crypto.randomUUID();
  const prefix = `corpus/${code}/${id}/parts/`;
  return NextResponse.json({ id, prefix, alreadyImported: false }, { status: 201 });
}
