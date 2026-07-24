import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const email = request.headers.get("oai-authenticated-user-email");
  const host = request.nextUrl.hostname;
  if (!email && host !== "localhost" && host !== "127.0.0.1") {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id } = await context.params;
  const row = await env.DB.prepare(
    "SELECT file_key, file_name, file_type FROM documents WHERE id = ?1"
  ).bind(id).first<{ file_key: string; file_name: string; file_type: string }>();
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
