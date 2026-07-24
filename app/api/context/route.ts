import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "../../../lib/access";

export const dynamic = "force-dynamic";

const personalSchema = `
  CREATE TABLE IF NOT EXISTS personal_contexts (
    email TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    coverage TEXT NOT NULL DEFAULT '',
    output_preferences TEXT NOT NULL DEFAULT '',
    working_method TEXT NOT NULL DEFAULT '',
    private_memory TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  )
`;

const tasksSchema = `
  CREATE TABLE IF NOT EXISTS task_contexts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    objective TEXT NOT NULL,
    topic TEXT NOT NULL DEFAULT 'General',
    status TEXT NOT NULL DEFAULT 'ready',
    owner_email TEXT NOT NULL,
    context_scope TEXT NOT NULL DEFAULT 'personal+team',
    output_format TEXT NOT NULL DEFAULT 'Concise brief with sources',
    guardrails TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

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

const documentContextSchema = `
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
    env.DB.prepare(documentContextSchema),
    env.DB.prepare(personalSchema),
    env.DB.prepare(tasksSchema),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS task_context_owner_idx ON task_contexts(owner_email)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS task_context_status_idx ON task_contexts(status)"),
  ]);
}

export async function GET() {
  const { user, response } = await requireAppUser();
  if (!user) return response;
  await prepareDb();

  const [personal, tasks, topicRows, sourceRows, counts] = await Promise.all([
    env.DB.prepare("SELECT * FROM personal_contexts WHERE email = ?1")
      .bind(user.email).first(),
    env.DB.prepare(
      `SELECT * FROM task_contexts
       WHERE owner_email = ?1
       ORDER BY updated_at DESC LIMIT 50`
    ).bind(user.email).all(),
    env.DB.prepare(
      `SELECT COALESCE(NULLIF(c.topics, ''), d.project) AS topic,
              COUNT(*) AS item_count,
              MAX(COALESCE(c.event_date, d.created_at)) AS last_signal
       FROM documents d
       LEFT JOIN document_context c ON c.document_id = d.id
       WHERE d.visibility = 'team' OR d.author_email = ?1
       GROUP BY topic
       ORDER BY last_signal DESC LIMIT 20`
    ).bind(user.email).all(),
    env.DB.prepare(
      `SELECT COALESCE(c.source_system, 'manual') AS source, COUNT(*) AS item_count
       FROM documents d
       LEFT JOIN document_context c ON c.document_id = d.id
       WHERE d.visibility = 'team' OR d.author_email = ?1
       GROUP BY source ORDER BY item_count DESC`
    ).bind(user.email).all(),
    env.DB.prepare(
      `SELECT
         SUM(CASE WHEN d.author_email = ?1 THEN 1 ELSE 0 END) AS personal_items,
         SUM(CASE WHEN d.visibility = 'team' THEN 1 ELSE 0 END) AS team_items,
         SUM(CASE WHEN d.importance = 'high' THEN 1 ELSE 0 END) AS high_signals
       FROM documents d
       WHERE d.visibility = 'team' OR d.author_email = ?1`
    ).bind(user.email).first(),
  ]);

  return NextResponse.json({
    user,
    personal: personal || {
      email: user.email,
      display_name: user.name,
      coverage: "",
      output_preferences: "",
      working_method: "",
      private_memory: "",
    },
    tasks: tasks.results,
    topics: topicRows.results,
    sources: sourceRows.results,
    counts: counts || { personal_items: 0, team_items: 0, high_signals: 0 },
  });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAppUser();
  if (!user) return response;
  await prepareDb();

  const form = await request.formData();
  const action = String(form.get("action") ?? "");
  const now = new Date().toISOString();

  if (action === "profile") {
    const coverage = String(form.get("coverage") ?? "").trim().slice(0, 4000);
    const outputPreferences = String(form.get("outputPreferences") ?? "").trim().slice(0, 4000);
    const workingMethod = String(form.get("workingMethod") ?? "").trim().slice(0, 4000);
    const privateMemory = String(form.get("privateMemory") ?? "").trim().slice(0, 8000);
    await env.DB.prepare(
      `INSERT INTO personal_contexts (
        email, display_name, coverage, output_preferences, working_method, private_memory, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      ON CONFLICT(email) DO UPDATE SET
        display_name = excluded.display_name,
        coverage = excluded.coverage,
        output_preferences = excluded.output_preferences,
        working_method = excluded.working_method,
        private_memory = excluded.private_memory,
        updated_at = excluded.updated_at`
    ).bind(user.email, user.name, coverage, outputPreferences, workingMethod, privateMemory, now).run();
    return NextResponse.json({ ok: true });
  }

  if (action === "task") {
    const title = String(form.get("title") ?? "").trim();
    const objective = String(form.get("objective") ?? "").trim();
    if (!title || !objective) {
      return NextResponse.json({ error: "Task title and objective are required." }, { status: 400 });
    }
    const id = crypto.randomUUID();
    const topic = String(form.get("topic") ?? "General").trim().slice(0, 180) || "General";
    const contextScope = String(form.get("contextScope") ?? "personal+team");
    const outputFormat = String(form.get("outputFormat") ?? "Concise brief with sources").trim().slice(0, 1000);
    const guardrails = String(form.get("guardrails") ?? "").trim().slice(0, 4000);
    await env.DB.prepare(
      `INSERT INTO task_contexts (
        id, title, objective, topic, status, owner_email, context_scope,
        output_format, guardrails, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, 'ready', ?5, ?6, ?7, ?8, ?9, ?9)`
    ).bind(id, title.slice(0, 180), objective.slice(0, 8000), topic, user.email, contextScope, outputFormat, guardrails, now).run();
    return NextResponse.json({ id }, { status: 201 });
  }

  return NextResponse.json({ error: "Unsupported context action." }, { status: 400 });
}
