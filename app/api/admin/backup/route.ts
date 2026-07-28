import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "../../../../lib/access";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

const SAFE_TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_TABLE_PAGE = 500;
const TEMPORARY_BACKUP_TOKEN_SHA256 =
  "b15a7ad92ce3165a34139b3774d13e09a3e56ffcce8ae3f6a080c97e07bf7102";

type SqliteObject = {
  name: string;
  type: string;
  sql: string | null;
};

type R2ObjectSummary = {
  key: string;
  size: number;
  etag: string;
  uploaded: string;
  httpMetadata?: Record<string, unknown>;
  customMetadata?: Record<string, string>;
};

function forbidden() {
  return NextResponse.json(
    { error: "Workspace owner or admin access is required." },
    { status: 403 },
  );
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifiedTable(name: string) {
  if (!SAFE_TABLE_NAME.test(name)) return null;
  return env.DB.prepare(
    `SELECT name, type, sql
     FROM sqlite_master
     WHERE type = 'table' AND name = ?1 AND name NOT LIKE 'sqlite_%'`,
  ).bind(name).first<SqliteObject>();
}

async function manifest(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get("cursor") || undefined;
  const tableRows = await env.DB.prepare(
    `SELECT name, type, sql
     FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
     ORDER BY name`,
  ).all<SqliteObject>();

  const tables = [];
  for (const table of tableRows.results ?? []) {
    const count = await env.DB.prepare(
      `SELECT COUNT(*) AS row_count FROM "${table.name}"`,
    ).first<{ row_count: number }>();
    tables.push({
      name: table.name,
      sql: table.sql,
      rowCount: Number(count?.row_count ?? 0),
    });
  }

  const listed = await env.FILES.list({
    limit: 1000,
    cursor,
    include: ["httpMetadata", "customMetadata"],
  });
  const objects: R2ObjectSummary[] = listed.objects.map((object) => ({
    key: object.key,
    size: object.size,
    etag: object.etag,
    uploaded: object.uploaded.toISOString(),
    httpMetadata: object.httpMetadata as Record<string, unknown> | undefined,
    customMetadata: object.customMetadata,
  }));

  return NextResponse.json({
    format: "level-grind-production-backup",
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    d1: { tables },
    r2: {
      objects,
      truncated: listed.truncated,
      cursor: listed.truncated ? listed.cursor : null,
    },
  });
}

async function tablePage(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") ?? "";
  const table = await verifiedTable(name);
  if (!table) {
    return NextResponse.json({ error: "Unknown table." }, { status: 404 });
  }

  const rawOffset = Number(request.nextUrl.searchParams.get("offset") ?? 0);
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? 200);
  const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(MAX_TABLE_PAGE, Math.max(1, Math.floor(rawLimit)))
    : 200;

  const result = await env.DB.prepare(
    `SELECT * FROM "${table.name}" ORDER BY rowid LIMIT ?1 OFFSET ?2`,
  ).bind(limit, offset).all<Record<string, unknown>>();
  const rows = result.results ?? [];

  return NextResponse.json({
    table: table.name,
    offset,
    limit,
    rows,
    nextOffset: rows.length === limit ? offset + rows.length : null,
  });
}

async function objectBody(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "R2 object key is required." }, { status: 400 });
  }

  const object = await env.FILES.get(key);
  if (!object) {
    return NextResponse.json({ error: "R2 object not found." }, { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", headers.get("Content-Type") || "application/octet-stream");
  headers.set("Content-Length", String(object.size));
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(key.split("/").at(-1) || "object")}`);
  return new Response(object.body, { headers });
}

export async function GET(request: NextRequest) {
  const configuredBackupToken = runtimeEnv("LEVEL_GRIND_BACKUP_TOKEN");
  const suppliedBackupToken = request.headers.get("x-level-grind-backup-token");
  const suppliedBackupTokenHash = suppliedBackupToken
    ? await sha256(suppliedBackupToken)
    : "";
  const hasOneTimeBackupAccess = Boolean(
    suppliedBackupToken &&
      (
        (configuredBackupToken && configuredBackupToken === suppliedBackupToken) ||
        suppliedBackupTokenHash === TEMPORARY_BACKUP_TOKEN_SHA256
      ),
  );

  if (!hasOneTimeBackupAccess) {
    const { user, response } = await requireAppUser(request);
    if (!user) return response;
    if (user.role !== "owner" && user.role !== "admin") return forbidden();
  }

  const scope = request.nextUrl.searchParams.get("scope") ?? "manifest";
  if (scope === "manifest") return manifest(request);
  if (scope === "table") return tablePage(request);
  if (scope === "object") return objectBody(request);
  return NextResponse.json({ error: "Unknown backup scope." }, { status: 400 });
}
