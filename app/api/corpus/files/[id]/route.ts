import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "../../../../../lib/access";
import { prepareCorpusDb } from "../../../../../lib/corpus";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  await prepareCorpusDb();
  const { id } = await context.params;
  const row = await env.DB.prepare(
    "SELECT file_key, file_name FROM corpus_documents WHERE id = ?1"
  ).bind(id).first<{ file_key: string; file_name: string }>();
  if (!row) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  const object = await env.FILES.get(row.file_key);
  if (!object) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
