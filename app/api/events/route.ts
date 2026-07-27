import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "../../../lib/access";
import {
  normalizeResearchEvent,
  prepareEventsDb,
  ResearchEventInput,
} from "../../../lib/events";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  await prepareEventsDb();

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const eventType = url.searchParams.get("type")?.trim().toUpperCase() ?? "";
  const where: string[] = [];
  const bindings: string[] = [];

  if (q) {
    where.push(`(
      LOWER(title) LIKE ?${bindings.length + 1} OR
      LOWER(summary) LIKE ?${bindings.length + 1} OR
      LOWER(company) LIKE ?${bindings.length + 1} OR
      LOWER(ticker) LIKE ?${bindings.length + 1} OR
      LOWER(product) LIKE ?${bindings.length + 1}
    )`);
    bindings.push(`%${q}%`);
  }
  if (eventType) {
    where.push(`event_type = ?${bindings.length + 1}`);
    bindings.push(eventType);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const query = env.DB.prepare(
    `SELECT id, title, event_type, event_date, effective_period, company, ticker,
            sector, geography, summary, event_nature, impact_type,
            impact_direction, priority, verification_status, confidence,
            verification_kind, verification_summary, metric_name, metric_object,
            expected_value, actual_value, unit, supplier, customer, product,
            date_precision, source_class, source_week, source_locator,
            raw_claim, verification_plan, pm_relevance, analyst_notes,
            source_system, source_title, source_url, source_message_id,
            source_excerpt, verification_sources_json, tags_json, created_by,
            created_at, updated_at
     FROM research_events
     ${whereSql}
     ORDER BY
       CASE priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 ELSE 2 END,
       COALESCE(event_date, created_at) DESC,
       title
     LIMIT 200`
  );

  const stats = await env.DB.prepare(
    `SELECT event_type, COUNT(*) AS count
     FROM research_events GROUP BY event_type ORDER BY count DESC`
  ).all();
  const events = bindings.length ? await query.bind(...bindings).all() : await query.all();
  return NextResponse.json({ user, events: events.results, stats: stats.results });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  if (user.role !== "owner" && user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  await prepareEventsDb();

  const body = await request.json() as ResearchEventInput | { events?: ResearchEventInput[] };
  const inputs = Array.isArray((body as { events?: ResearchEventInput[] }).events)
    ? (body as { events: ResearchEventInput[] }).events
    : [body as ResearchEventInput];
  if (!inputs.length || inputs.length > 500) {
    return NextResponse.json({ error: "Provide 1-500 events." }, { status: 400 });
  }

  const normalized = inputs.map((event) => normalizeResearchEvent(event, user.email));
  const statements = normalized.map((event) =>
    env.DB.prepare(
      `INSERT INTO research_events (
         id, title, event_type, event_date, effective_period, company, ticker,
         sector, geography, summary, event_nature, impact_type, impact_direction,
         priority, verification_status, verification_kind, verification_summary,
         confidence, metric_name, metric_object, expected_value, actual_value,
         unit, supplier, customer, product, date_precision, source_class,
         source_week, source_locator, raw_claim, verification_plan,
         pm_relevance, analyst_notes, source_system, source_title, source_url,
         source_message_id, source_excerpt, verification_sources_json,
         tags_json, created_by, created_at, updated_at
       ) VALUES (
         ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16,
         ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30,
         ?31, ?32, ?33, ?34, ?35, ?36, ?37, ?38, ?39, ?40, ?41, ?42, ?43, ?44
       )
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         event_type = excluded.event_type,
         event_date = excluded.event_date,
         effective_period = excluded.effective_period,
         company = excluded.company,
         ticker = excluded.ticker,
         sector = excluded.sector,
         geography = excluded.geography,
         summary = excluded.summary,
         event_nature = excluded.event_nature,
         impact_type = excluded.impact_type,
         impact_direction = excluded.impact_direction,
         priority = excluded.priority,
         verification_status = excluded.verification_status,
         verification_kind = excluded.verification_kind,
         verification_summary = excluded.verification_summary,
         confidence = excluded.confidence,
         metric_name = excluded.metric_name,
         metric_object = excluded.metric_object,
         expected_value = excluded.expected_value,
         actual_value = excluded.actual_value,
         unit = excluded.unit,
         supplier = excluded.supplier,
         customer = excluded.customer,
         product = excluded.product,
         date_precision = excluded.date_precision,
         source_class = excluded.source_class,
         source_week = excluded.source_week,
         source_locator = excluded.source_locator,
         raw_claim = excluded.raw_claim,
         verification_plan = excluded.verification_plan,
         pm_relevance = excluded.pm_relevance,
         analyst_notes = excluded.analyst_notes,
         source_system = excluded.source_system,
         source_title = excluded.source_title,
         source_url = excluded.source_url,
         source_message_id = excluded.source_message_id,
         source_excerpt = excluded.source_excerpt,
         verification_sources_json = excluded.verification_sources_json,
         tags_json = excluded.tags_json,
         updated_at = excluded.updated_at`
    ).bind(
      event.id,
      event.title,
      event.eventType,
      event.eventDate,
      event.effectivePeriod,
      event.company,
      event.ticker,
      event.sector,
      event.geography,
      event.summary,
      event.eventNature,
      event.impactType,
      event.impactDirection,
      event.priority,
      event.verificationStatus,
      event.verificationKind,
      event.verificationSummary,
      event.confidence,
      event.metricName,
      event.metricObject,
      event.expectedValue,
      event.actualValue,
      event.unit,
      event.supplier,
      event.customer,
      event.product,
      event.datePrecision,
      event.sourceClass,
      event.sourceWeek,
      event.sourceLocator,
      event.rawClaim,
      event.verificationPlan,
      event.pmRelevance,
      event.analystNotes,
      event.sourceSystem,
      event.sourceTitle,
      event.sourceUrl,
      event.sourceMessageId,
      event.sourceExcerpt,
      event.verificationSourcesJson,
      event.tagsJson,
      event.createdBy,
      event.createdAt,
      event.updatedAt,
    )
  );
  await env.DB.batch(statements);
  return NextResponse.json({ ok: true, imported: normalized.length });
}
