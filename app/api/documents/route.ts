import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "../../../lib/access";

export const dynamic = "force-dynamic";

type ContextScope = "personal" | "team" | "personal+team";

type DocumentRow = {
  id: string;
  title: string;
  kind: string;
  body: string;
  source_url?: string | null;
  author_email: string;
  author_name: string;
  project: string;
  importance: string;
  visibility: string;
  file_key?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  created_at: string;
  updated_at: string;
  context_scope: string;
  source_system: string;
  topics: string;
  event_date?: string | null;
  confidence: string;
};

const documentsSchema = `
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    source_url TEXT,
    author_email TEXT NOT NULL,
    author_name TEXT NOT NULL,
    project TEXT NOT NULL DEFAULT 'General',
    importance TEXT NOT NULL DEFAULT 'normal',
    visibility TEXT NOT NULL DEFAULT 'team',
    file_key TEXT,
    file_name TEXT,
    file_type TEXT,
    file_size INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

const contextSchema = `
  CREATE TABLE IF NOT EXISTS document_context (
    document_id TEXT PRIMARY KEY,
    context_scope TEXT NOT NULL DEFAULT 'team',
    source_system TEXT NOT NULL DEFAULT 'manual',
    topics TEXT NOT NULL DEFAULT '',
    event_date TEXT,
    confidence TEXT NOT NULL DEFAULT 'medium',
    FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
  )
`;

async function prepareDb() {
  await env.DB.batch([
    env.DB.prepare(documentsSchema),
    env.DB.prepare(contextSchema),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS documents_created_idx ON documents(created_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS document_context_scope_idx ON document_context(context_scope)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS document_context_source_idx ON document_context(source_system)"),
  ]);
}

function parseScope(value: FormDataEntryValue | string | null | undefined): ContextScope {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "personal" || normalized === "team") return normalized;
  if (normalized === "personal+team" || normalized === "team+personal" || normalized === "both") {
    return "personal+team";
  }
  return "team";
}

function mergeScopes(scopes: string[]): ContextScope {
  const hasPersonal = scopes.some((scope) => scope === "personal" || scope === "personal+team");
  const hasTeam = scopes.some((scope) => scope === "team" || scope === "personal+team");
  if (hasPersonal && hasTeam) return "personal+team";
  return hasPersonal ? "personal" : "team";
}

function duplicateKey(row: DocumentRow) {
  if (row.kind === "file") return `file:${row.id}`;
  return [
    row.author_email.toLowerCase(),
    row.kind,
    row.title.trim().toLowerCase(),
    row.body.trim(),
    String(row.source_url ?? "").trim().toLowerCase(),
  ].join("\u001f");
}

function mergeDuplicateRows(rows: DocumentRow[]) {
  const grouped = new Map<string, DocumentRow & { duplicate_ids: string[] }>();
  for (const row of rows) {
    const key = duplicateKey(row);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...row, context_scope: parseScope(row.context_scope), duplicate_ids: [row.id] });
      continue;
    }
    existing.duplicate_ids.push(row.id);
    existing.context_scope = mergeScopes([existing.context_scope, row.context_scope]);
  }
  return Array.from(grouped.values());
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;

  await prepareDb();
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const scope = request.nextUrl.searchParams.get("scope") ?? "team";
  const like = `%${query}%`;
  const personal = scope === "mine" || scope === "personal";
  const accessClause = personal
    ? "d.author_email = ?1"
    : "(d.visibility = 'team' OR d.author_email = ?1)";
  const statement = env.DB.prepare(
    `SELECT d.*,
            COALESCE(c.context_scope, CASE WHEN d.visibility = 'team' THEN 'team' ELSE 'personal' END) AS context_scope,
            COALESCE(c.source_system, 'manual') AS source_system,
            COALESCE(c.topics, d.project) AS topics,
            c.event_date,
            COALESCE(c.confidence, 'medium') AS confidence
     FROM documents d
     LEFT JOIN document_context c ON c.document_id = d.id
     WHERE ${accessClause}
       AND (?2 = '' OR d.title LIKE ?3 OR d.body LIKE ?3 OR d.project LIKE ?3
         OR c.topics LIKE ?3 OR c.source_system LIKE ?3)
     ORDER BY COALESCE(c.event_date, d.created_at) DESC
     LIMIT 150`
  ).bind(user.email, query, like);
  const result = await statement.all<DocumentRow>();
  return NextResponse.json({ documents: mergeDuplicateRows(result.results), user });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;

  await prepareDb();
  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const sourceUrl = String(form.get("sourceUrl") ?? "").trim();
  const project = String(form.get("project") ?? "General").trim() || "General";
  const importance = String(form.get("importance") ?? "normal");
  const contextScope = parseScope(form.get("contextScope"));
  const visibility = contextScope === "personal" ? "private" : "team";
  const sourceSystem = String(form.get("sourceSystem") ?? "manual").trim().slice(0, 80) || "manual";
  const topics = String(form.get("topics") ?? project).trim().slice(0, 500);
  const eventDate = String(form.get("eventDate") ?? "").trim();
  const confidence = ["low", "medium", "high"].includes(String(form.get("confidence")))
    ? String(form.get("confidence"))
    : "medium";
  const file = form.get("file");

  if (!title || title.length > 180) {
    return NextResponse.json({ error: "Title is required and must be under 180 characters." }, { status: 400 });
  }
  if (body.length > 500_000) {
    return NextResponse.json({ error: "Text is too large." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  let kind = sourceUrl ? "link" : "note";
  let fileKey: string | null = null;
  let fileName: string | null = null;
  let fileType: string | null = null;
  let fileSize: number | null = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Files must be 25 MB or smaller." }, { status: 400 });
    }
    kind = "file";
    fileName = file.name.slice(0, 240);
    fileType = file.type || "application/octet-stream";
    fileSize = file.size;
    fileKey = `${user.email}/${id}/${fileName}`;
    await env.FILES.put(fileKey, file.stream(), {
      httpMetadata: { contentType: fileType },
      customMetadata: { documentId: id, owner: user.email },
    });
  }

  if (!fileKey) {
    const duplicates = await env.DB.prepare(
      `SELECT d.id, COALESCE(c.context_scope, CASE WHEN d.visibility = 'team' THEN 'team' ELSE 'personal' END) AS context_scope
       FROM documents d
       LEFT JOIN document_context c ON c.document_id = d.id
       WHERE d.author_email = ?1 AND d.kind = ?2 AND d.title = ?3 AND d.body = ?4
         AND COALESCE(d.source_url, '') = ?5 AND d.file_key IS NULL
       ORDER BY d.updated_at DESC`
    ).bind(user.email, kind, title, body, sourceUrl).all<{ id: string; context_scope: string }>();
    if (duplicates.results.length) {
      const canonical = duplicates.results[0];
      const mergedScope = mergeScopes([
        contextScope,
        ...duplicates.results.map((item) => item.context_scope),
      ]);
      const statements = [
        env.DB.prepare(
          `UPDATE documents SET project = ?1, importance = ?2, visibility = ?3,
             source_url = ?4, updated_at = ?5 WHERE id = ?6`
        ).bind(
          project, importance, mergedScope === "personal" ? "private" : "team",
          sourceUrl || null, now, canonical.id,
        ),
        env.DB.prepare(
          `INSERT INTO document_context (
             document_id, context_scope, source_system, topics, event_date, confidence
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
           ON CONFLICT(document_id) DO UPDATE SET
             context_scope = excluded.context_scope,
             source_system = excluded.source_system,
             topics = excluded.topics,
             event_date = excluded.event_date,
             confidence = excluded.confidence`
        ).bind(
          canonical.id, mergedScope, sourceSystem, topics,
          eventDate || now.slice(0, 10), confidence,
        ),
        ...duplicates.results.slice(1).flatMap((item) => [
          env.DB.prepare("DELETE FROM document_context WHERE document_id = ?1").bind(item.id),
          env.DB.prepare("DELETE FROM documents WHERE id = ?1").bind(item.id),
        ]),
      ];
      await env.DB.batch(statements);
      return NextResponse.json({ id: canonical.id, merged: true, contextScope: mergedScope });
    }
  }

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO documents (
        id, title, kind, body, source_url, author_email, author_name, project,
        importance, visibility, file_key, file_name, file_type, file_size,
        created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`
    ).bind(
      id, title, kind, body, sourceUrl || null, user.email, user.name, project,
      importance, visibility, fileKey, fileName, fileType, fileSize, now, now
    ),
    env.DB.prepare(
      `INSERT INTO document_context (
        document_id, context_scope, source_system, topics, event_date, confidence
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    ).bind(id, contextScope, sourceSystem, topics, eventDate || now.slice(0, 10), confidence),
  ]);

  return NextResponse.json({ id }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;

  await prepareDb();
  const form = await request.formData();
  const id = String(form.get("id") ?? "").trim();
  const duplicateIds = (() => {
    try {
      const parsed = JSON.parse(String(form.get("duplicateIds") ?? "[]"));
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  })();
  const ids = Array.from(new Set([id, ...duplicateIds].filter(Boolean))).slice(0, 50);
  if (!ids.length) {
    return NextResponse.json({ error: "Document id is required." }, { status: 400 });
  }

  const placeholders = ids.map((_, index) => `?${index + 1}`).join(", ");
  const records = await env.DB.prepare(
    `SELECT id, author_email, file_key FROM documents WHERE id IN (${placeholders})`
  ).bind(...ids).all<{ id: string; author_email: string; file_key?: string | null }>();
  if (!records.results.some((record) => record.id === id)) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  const canManageAll = records.results.every((record) =>
    record.author_email === user.email || user.role === "owner" || user.role === "admin"
  );
  if (!canManageAll) {
    return NextResponse.json({ error: "You do not have permission to edit this material." }, { status: 403 });
  }
  if (records.results.some((record) => record.id !== id && record.file_key)) {
    return NextResponse.json({ error: "File records cannot be merged automatically." }, { status: 409 });
  }

  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const sourceUrl = String(form.get("sourceUrl") ?? "").trim();
  const project = String(form.get("project") ?? "General").trim() || "General";
  const contextScope = parseScope(form.get("contextScope"));
  const sourceSystem = String(form.get("sourceSystem") ?? "manual").trim().slice(0, 80) || "manual";
  const topics = String(form.get("topics") ?? project).trim().slice(0, 500) || project;
  const eventDate = String(form.get("eventDate") ?? "").trim();
  if (!title || title.length > 180 || body.length > 500_000) {
    return NextResponse.json({ error: "Title or note length is invalid." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const target = records.results.find((record) => record.id === id);
  const kind = target?.file_key ? "file" : sourceUrl ? "link" : "note";
  const statements = [
    env.DB.prepare(
      `UPDATE documents SET title = ?1, kind = ?2, body = ?3, source_url = ?4,
         project = ?5, visibility = ?6, updated_at = ?7 WHERE id = ?8`
    ).bind(
      title, kind, body, sourceUrl || null, project,
      contextScope === "personal" ? "private" : "team", now, id,
    ),
    env.DB.prepare(
      `INSERT INTO document_context (
         document_id, context_scope, source_system, topics, event_date, confidence
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(document_id) DO UPDATE SET
         context_scope = excluded.context_scope,
         source_system = excluded.source_system,
         topics = excluded.topics,
         event_date = excluded.event_date`
    ).bind(id, contextScope, sourceSystem, topics, eventDate || null, "medium"),
    ...ids.filter((duplicateId) => duplicateId !== id).flatMap((duplicateId) => [
      env.DB.prepare("DELETE FROM document_context WHERE document_id = ?1").bind(duplicateId),
      env.DB.prepare("DELETE FROM documents WHERE id = ?1").bind(duplicateId),
    ]),
  ];
  await env.DB.batch(statements);
  return NextResponse.json({ id, mergedCount: ids.length });
}

export async function DELETE(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;

  await prepareDb();
  const payload = await request.json() as { ids?: unknown };
  const ids = Array.from(new Set(
    (Array.isArray(payload.ids) ? payload.ids : []).map(String).filter(Boolean)
  )).slice(0, 50);
  if (!ids.length) {
    return NextResponse.json({ error: "Choose material to delete." }, { status: 400 });
  }

  const placeholders = ids.map((_, index) => `?${index + 1}`).join(", ");
  const records = await env.DB.prepare(
    `SELECT id, author_email, file_key FROM documents WHERE id IN (${placeholders})`
  ).bind(...ids).all<{ id: string; author_email: string; file_key?: string | null }>();
  const canManageAll = records.results.length === ids.length && records.results.every((record) =>
    record.author_email === user.email || user.role === "owner" || user.role === "admin"
  );
  if (!canManageAll) {
    return NextResponse.json({ error: "You do not have permission to delete this material." }, { status: 403 });
  }

  await env.DB.batch(ids.flatMap((documentId) => [
    env.DB.prepare("DELETE FROM document_context WHERE document_id = ?1").bind(documentId),
    env.DB.prepare("DELETE FROM documents WHERE id = ?1").bind(documentId),
  ]));
  await Promise.all(records.results.flatMap((record) =>
    record.file_key ? [env.FILES.delete(record.file_key)] : []
  ));
  return NextResponse.json({ deleted: ids.length });
}
