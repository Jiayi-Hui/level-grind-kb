import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "../../../lib/access";
import {
  clean,
  cleanVariable,
  type ModelVariableInput,
  prepareModelDb,
} from "../../../lib/model-workbooks";

export const dynamic = "force-dynamic";

type ModelRow = {
  id: string;
  model_name: string;
  company: string;
  ticker: string;
  sector: string;
  owner_email: string;
  owner_name: string;
  version: string;
  status: string;
  file_name: string;
  file_size: number;
  source_notes: string;
  created_at: string;
  updated_at: string;
  stale_count: number;
  pending_count: number;
};

export async function GET(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  await prepareModelDb();

  const modelId = clean(request.nextUrl.searchParams.get("id"), 80);
  const models = await env.DB.prepare(
    `SELECT m.id, m.model_name, m.company, m.ticker, m.sector, m.owner_email,
            m.owner_name, m.version, m.status, m.file_name, m.file_size,
            m.source_notes, m.created_at, m.updated_at,
            (SELECT COUNT(*) FROM model_variables v WHERE v.model_id = m.id AND v.is_stale = 1) AS stale_count,
            (SELECT COUNT(*) FROM model_update_queue q WHERE q.model_id = m.id AND q.status = 'pending') AS pending_count
     FROM model_workbooks m
     ORDER BY m.updated_at DESC`
  ).all<ModelRow>();

  const selectedId = modelId || models.results[0]?.id || "";
  if (!selectedId) {
    return NextResponse.json({ models: [], variables: [], updates: [], changes: [] });
  }
  const selected = models.results.find((model) => model.id === selectedId);
  if (!selected) return NextResponse.json({ error: "Model not found." }, { status: 404 });

  const [variables, updates, changes] = await Promise.all([
    env.DB.prepare(
      `SELECT * FROM model_variables WHERE model_id = ?1
       ORDER BY CASE kind WHEN 'input' THEN 0 WHEN 'calculation' THEN 1 ELSE 2 END, variable_key`
    ).bind(selectedId).all(),
    env.DB.prepare(
      `SELECT q.*, v.variable_key, v.label, v.unit
       FROM model_update_queue q JOIN model_variables v ON v.id = q.variable_id
       WHERE q.model_id = ?1 ORDER BY CASE q.status WHEN 'pending' THEN 0 ELSE 1 END, q.created_at DESC LIMIT 100`
    ).bind(selectedId).all(),
    env.DB.prepare(
      "SELECT * FROM model_change_log WHERE model_id = ?1 ORDER BY created_at DESC LIMIT 100"
    ).bind(selectedId).all(),
  ]);

  return NextResponse.json({
    models: models.results,
    selected,
    variables: variables.results,
    updates: updates.results,
    changes: changes.results,
  });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  await prepareModelDb();
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose an Excel workbook." }, { status: 400 });
  }
  if (!/\.xlsx$/i.test(file.name) || file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Upload an .xlsx workbook no larger than 20 MB." }, { status: 400 });
  }
  const modelName = clean(form.get("modelName"), 180);
  const company = clean(form.get("company"), 180);
  if (!modelName || !company) {
    return NextResponse.json({ error: "Model name and company are required." }, { status: 400 });
  }
  let rawVariables: ModelVariableInput[] = [];
  try {
    const parsed = JSON.parse(String(form.get("variablesJson") || "[]"));
    if (Array.isArray(parsed)) rawVariables = parsed.slice(0, 500);
  } catch {
    return NextResponse.json({ error: "Workbook variable map is invalid." }, { status: 400 });
  }
  const variables = rawVariables.map(cleanVariable);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const fileName = file.name.slice(0, 240);
  const fileKey = `models/${id}/${fileName}`;
  await env.FILES.put(fileKey, file.stream(), {
    httpMetadata: {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      contentDisposition: `attachment; filename="${fileName.replaceAll('"', "")}"`,
    },
    customMetadata: { modelId: id, owner: user.email },
  });
  const statements = [
    env.DB.prepare(
      `INSERT INTO model_workbooks (
        id, model_name, company, ticker, sector, owner_email, owner_name, version,
        status, file_key, file_name, file_size, source_notes, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'active', ?9, ?10, ?11, ?12, ?13, ?13)`
    ).bind(
      id, modelName, company, clean(form.get("ticker"), 40), clean(form.get("sector"), 120),
      user.email, clean(form.get("ownerName"), 120) || user.name,
      clean(form.get("version"), 40) || "v1", fileKey, fileName, file.size,
      clean(form.get("sourceNotes"), 1000), now,
    ),
    env.DB.prepare(
      `INSERT INTO model_change_log (id, model_id, actor_email, action, summary, created_at)
       VALUES (?1, ?2, ?3, 'uploaded', ?4, ?5)`
    ).bind(crypto.randomUUID(), id, user.email, `Uploaded ${fileName}`, now),
    ...variables.map((variable) =>
      env.DB.prepare(
        `INSERT INTO model_variables (
          id, model_id, variable_key, label, kind, sheet_name, cell_ref, value,
          formula, unit, period, source_system, source_url, source_date, is_stale, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`
      ).bind(
        variable.id, id, variable.key, variable.label, variable.kind, variable.sheetName,
        variable.cellRef, variable.value, variable.formula, variable.unit, variable.period,
        variable.sourceSystem, variable.sourceUrl, variable.sourceDate, variable.isStale ? 1 : 0, now,
      )
    ),
  ];
  await env.DB.batch(statements);
  return NextResponse.json({ id, variableCount: variables.length }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  await prepareModelDb();
  const body = await request.json() as Record<string, unknown>;
  const action = clean(body.action, 40);
  const modelId = clean(body.modelId, 80);
  const model = await env.DB.prepare(
    "SELECT id, company FROM model_workbooks WHERE id = ?1"
  ).bind(modelId).first<{ id: string; company: string }>();
  if (!model) return NextResponse.json({ error: "Model not found." }, { status: 404 });
  const now = new Date().toISOString();

  if (action === "update-variable") {
    const variableId = clean(body.variableId, 80);
    const value = clean(body.value, 100);
    const variable = await env.DB.prepare(
      "SELECT label FROM model_variables WHERE id = ?1 AND model_id = ?2"
    ).bind(variableId, modelId).first<{ label: string }>();
    if (!variable) return NextResponse.json({ error: "Variable not found." }, { status: 404 });
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE model_variables SET value = ?1, is_stale = 0, updated_at = ?2 WHERE id = ?3 AND model_id = ?4"
      ).bind(value, now, variableId, modelId),
      env.DB.prepare(
        `INSERT INTO model_change_log (id, model_id, actor_email, action, summary, created_at)
         VALUES (?1, ?2, ?3, 'input_updated', ?4, ?5)`
      ).bind(crypto.randomUUID(), modelId, user.email, `${variable.label} → ${value}`, now),
    ]);
    return NextResponse.json({ ok: true });
  }

  if (action === "accept-update") {
    const updateId = clean(body.updateId, 80);
    const value = clean(body.value, 100);
    const update = await env.DB.prepare(
      `SELECT q.variable_id, v.label FROM model_update_queue q
       JOIN model_variables v ON v.id = q.variable_id
       WHERE q.id = ?1 AND q.model_id = ?2 AND q.status = 'pending'`
    ).bind(updateId, modelId).first<{ variable_id: string; label: string }>();
    if (!update) return NextResponse.json({ error: "Pending update not found." }, { status: 404 });
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE model_variables SET value = ?1, is_stale = 0, updated_at = ?2 WHERE id = ?3"
      ).bind(value, now, update.variable_id),
      env.DB.prepare(
        "UPDATE model_update_queue SET proposed_value = ?1, status = 'approved', reviewed_by = ?2, reviewed_at = ?3 WHERE id = ?4"
      ).bind(value, user.email, now, updateId),
      env.DB.prepare(
        `INSERT INTO model_change_log (id, model_id, actor_email, action, summary, created_at)
         VALUES (?1, ?2, ?3, 'source_update_approved', ?4, ?5)`
      ).bind(crypto.randomUUID(), modelId, user.email, `${update.label} → ${value}`, now),
    ]);
    return NextResponse.json({ ok: true });
  }

  if (action === "scan-updates") {
    const variables = await env.DB.prepare(
      "SELECT id, label, source_date FROM model_variables WHERE model_id = ?1 AND kind = 'input'"
    ).bind(modelId).all<{ id: string; label: string; source_date: string | null }>();
    const reports = await env.DB.prepare(
      `SELECT id, title, published_at FROM corpus_documents
       WHERE LOWER(company_name) = LOWER(?1) ORDER BY published_at DESC LIMIT 3`
    ).bind(model.company).all<{ id: string; title: string; published_at: string }>();
    const events = await env.DB.prepare(
      `SELECT id, title, COALESCE(event_date, updated_at) AS source_date FROM research_events
       WHERE LOWER(company) = LOWER(?1) ORDER BY COALESCE(event_date, updated_at) DESC LIMIT 5`
    ).bind(model.company).all<{ id: string; title: string; source_date: string }>();
    const inserts: D1PreparedStatement[] = [];
    for (const variable of variables.results) {
      for (const report of reports.results) {
        if (variable.source_date && report.published_at <= variable.source_date) continue;
        inserts.push(env.DB.prepare(
          `INSERT OR IGNORE INTO model_update_queue (
            id, model_id, variable_id, source_type, source_id, source_label,
            source_date, proposed_value, status, created_at
          ) VALUES (?1, ?2, ?3, 'report', ?4, ?5, ?6, '', 'pending', ?7)`
        ).bind(crypto.randomUUID(), modelId, variable.id, report.id, report.title, report.published_at, now));
      }
      for (const event of events.results) {
        if (variable.source_date && event.source_date <= variable.source_date) continue;
        inserts.push(env.DB.prepare(
          `INSERT OR IGNORE INTO model_update_queue (
            id, model_id, variable_id, source_type, source_id, source_label,
            source_date, proposed_value, status, created_at
          ) VALUES (?1, ?2, ?3, 'event', ?4, ?5, ?6, '', 'pending', ?7)`
        ).bind(crypto.randomUUID(), modelId, variable.id, event.id, event.title, event.source_date, now));
      }
    }
    if (inserts.length) await env.DB.batch(inserts);
    await env.DB.prepare(
      `UPDATE model_variables SET is_stale = CASE WHEN EXISTS (
        SELECT 1 FROM model_update_queue q WHERE q.variable_id = model_variables.id AND q.status = 'pending'
      ) THEN 1 ELSE is_stale END WHERE model_id = ?1`
    ).bind(modelId).run();
    const queue = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM model_update_queue WHERE model_id = ?1 AND status = 'pending'"
    ).bind(modelId).first<{ count: number }>();
    return NextResponse.json({ queued: Number(queue?.count || 0) });
  }
  return NextResponse.json({ error: "Unsupported model action." }, { status: 400 });
}
