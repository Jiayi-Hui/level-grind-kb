import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "../../../lib/access";
import {
  normalizeResearchEventNotice,
  prepareEventsDb,
  ResearchEventNoticeInput,
} from "../../../lib/events";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  await prepareEventsDb();

  const eventId = new URL(request.url).searchParams.get("eventId")?.trim() ?? "";
  const query = eventId
    ? env.DB.prepare(
      `SELECT * FROM research_event_notices
       WHERE event_id = ?1 ORDER BY noticed_at DESC LIMIT 200`
    ).bind(eventId)
    : env.DB.prepare(
      `SELECT * FROM research_event_notices ORDER BY noticed_at DESC LIMIT 200`
    );
  const notices = await query.all();
  return NextResponse.json({ user, notices: notices.results });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  if (user.role !== "owner" && user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  await prepareEventsDb();

  const body = await request.json() as
    | ResearchEventNoticeInput
    | { notices?: ResearchEventNoticeInput[] };
  const inputs = Array.isArray((body as { notices?: ResearchEventNoticeInput[] }).notices)
    ? (body as { notices: ResearchEventNoticeInput[] }).notices
    : [body as ResearchEventNoticeInput];
  if (!inputs.length || inputs.length > 500) {
    return NextResponse.json({ error: "Provide 1-500 notices." }, { status: 400 });
  }

  const normalized = inputs.map((notice) =>
    normalizeResearchEventNotice(notice, user.email)
  );
  await env.DB.batch(normalized.map((notice) =>
    env.DB.prepare(
      `INSERT INTO research_event_notices (
         id, event_id, noticed_by, noticed_at, channel, notice_type, salience,
         summary, source_message_id, created_by, created_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
       ON CONFLICT(id) DO UPDATE SET
         event_id = excluded.event_id,
         noticed_by = excluded.noticed_by,
         noticed_at = excluded.noticed_at,
         channel = excluded.channel,
         notice_type = excluded.notice_type,
         salience = excluded.salience,
         summary = excluded.summary,
         source_message_id = excluded.source_message_id,
         updated_at = excluded.updated_at`
    ).bind(
      notice.id,
      notice.eventId,
      notice.noticedBy,
      notice.noticedAt,
      notice.channel,
      notice.noticeType,
      notice.salience,
      notice.summary,
      notice.sourceMessageId,
      notice.createdBy,
      notice.createdAt,
      notice.updatedAt,
    )
  ));
  return NextResponse.json({ ok: true, imported: normalized.length });
}
