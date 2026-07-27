import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "../../../../../lib/access";
import { prepareModelDb } from "../../../../../lib/model-workbooks";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  await prepareModelDb();
  const { id } = await context.params;
  const model = await env.DB.prepare(
    "SELECT file_key, file_name FROM model_workbooks WHERE id = ?1"
  ).bind(id).first<{ file_key: string; file_name: string }>();
  if (!model) return NextResponse.json({ error: "Model not found." }, { status: 404 });
  const object = await env.FILES.get(model.file_key);
  if (!object) return NextResponse.json({ error: "Workbook file not found." }, { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  headers.set("Content-Disposition", `attachment; filename="${model.file_name.replaceAll('"', "")}"`);
  return new Response(object.body, { headers });
}
