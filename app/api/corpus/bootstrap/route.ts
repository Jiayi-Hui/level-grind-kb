import { NextRequest, NextResponse } from "next/server";
import {
  CorpusImportError,
  importCorpusPdf,
} from "../../../../lib/corpus-import";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

async function matchesImportKey(supplied: string, expected: string) {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const leftBytes = new Uint8Array(left);
  const rightBytes = new Uint8Array(right);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

export async function POST(request: NextRequest) {
  const expected = runtimeEnv("CORPUS_IMPORT_KEY");
  if (!expected) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!supplied || !(await matchesImportKey(supplied, expected))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

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
