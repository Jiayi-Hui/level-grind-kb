import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireCorpusBootstrap } from "../../../../../lib/corpus-bootstrap";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  const denied = await requireCorpusBootstrap(request);
  if (denied) return denied;
  const prefix = request.headers.get("x-file-prefix") ?? "";
  const partNumber = Number(request.headers.get("x-part-number") ?? "");
  if (!/^corpus\/[A-Za-z0-9._-]+\/[a-f0-9-]+\/parts\/$/.test(prefix)) {
    return NextResponse.json({ error: "Invalid file prefix." }, { status: 400 });
  }
  if (!Number.isInteger(partNumber) || partNumber < 0 || partNumber > 99) {
    return NextResponse.json({ error: "Invalid part number." }, { status: 400 });
  }
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 3_500_000) {
    return NextResponse.json({ error: "Invalid part size." }, { status: 400 });
  }
  const key = `${prefix}${String(partNumber).padStart(4, "0")}`;
  await env.FILES.put(key, bytes, {
    httpMetadata: { contentType: "application/octet-stream" },
  });
  return NextResponse.json({ key, bytes: bytes.byteLength });
}
