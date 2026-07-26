import { NextRequest, NextResponse } from "next/server";
import { runtimeEnv } from "./runtime-env";

export async function requireCorpusBootstrap(request: NextRequest) {
  const expected = runtimeEnv("CORPUS_IMPORT_KEY");
  if (!expected) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!supplied) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

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
  return difference === 0
    ? null
    : NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}
