import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "../../../../lib/access";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;

  const { id } = await context.params;
  const row = await env.DB.prepare(
    `SELECT file_key, file_name, file_type
     FROM documents
     WHERE id = ?1 AND (visibility = 'team' OR author_email = ?2)`
  ).bind(id, user.email).first<{ file_key: string; file_name: string; file_type: string }>();
  if (!row?.file_key) return NextResponse.json({ error: "File not found" }, { status: 404 });

  const object = await env.FILES.get(row.file_key);
  if (!object) return NextResponse.json({ error: "File not found" }, { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": row.file_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
