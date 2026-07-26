import { NextRequest, NextResponse } from "next/server";
import {
  CorpusImportError,
  importCorpusPdf,
} from "../../../../lib/corpus-import";
import { requireCorpusBootstrap } from "../../../../lib/corpus-bootstrap";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const denied = await requireCorpusBootstrap(request);
  if (denied) return denied;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A PDF file is required." }, { status: 400 });
  }

  try {
    const result = await importCorpusPdf(
      file,
      {
        securityCode: String(form.get("securityCode") ?? ""),
        companyName: String(form.get("companyName") ?? ""),
        title: String(form.get("title") ?? file.name),
        documentType: String(form.get("documentType") ?? "annual-report"),
        publishedAt: String(form.get("publishedAt") ?? ""),
        sourceUrl: String(form.get("sourceUrl") ?? ""),
      },
      "bootstrap-import",
    );
    return NextResponse.json(result, { status: result.alreadyImported ? 200 : 201 });
  } catch (error) {
    if (error instanceof CorpusImportError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
