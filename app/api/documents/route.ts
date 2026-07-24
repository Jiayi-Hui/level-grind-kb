import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

function identity(request: NextRequest) {
  const email = request.headers.get("oai-authenticated-user-email");
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  let name = email?.split("@")[0] ?? "";
  if (encodedName && encoding === "percent-encoded-utf-8") {
    try {
      name = decodeURIComponent(encodedName);
    } catch {
      // Keep the safe email-derived fallback.
    }
  }
  if (email) return { email, name };
  const host = request.nextUrl.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return { email: "owner@level-grind.com", name: "Level Grind Owner" };
  }
  return null;
}

async function prepareDb() {
  await env.DB.batch([
    env.DB.prepare(documentsSchema),
    env.DB.prepare(contextSchema),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS documents_created_idx ON documents(created_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS document_context_scope_idx ON document_context(context_scope)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS document_context_source_idx ON document_context(source_system)"),
  ]);
}

export async function GET(request: NextRequest) {
  const user = identity(request);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

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
  const result = await statement.all();
  return NextResponse.json({ documents: result.results, user });
}

export async function POST(request: NextRequest) {
  const user = identity(request);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  await prepareDb();
  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const sourceUrl = String(form.get("sourceUrl") ?? "").trim();
  const project = String(form.get("project") ?? "General").trim() || "General";
  const importance = String(form.get("importance") ?? "normal");
  const contextScope = String(form.get("contextScope") ?? "team") === "personal" ? "personal" : "team";
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
