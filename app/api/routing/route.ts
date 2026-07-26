import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "../../../lib/access";

export const dynamic = "force-dynamic";

const policySchema = `
  CREATE TABLE IF NOT EXISTS routing_policies (
    email TEXT PRIMARY KEY,
    reminder_enabled INTEGER NOT NULL DEFAULT 1,
    trigger_rules TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  )
`;

const workstreamsSchema = `
  CREATE TABLE IF NOT EXISTS conversation_workstreams (
    id TEXT PRIMARY KEY,
    owner_email TEXT NOT NULL,
    project_name TEXT NOT NULL,
    chat_title TEXT NOT NULL,
    active_goal TEXT NOT NULL,
    deliverable TEXT NOT NULL DEFAULT '',
    shift_reason TEXT NOT NULL DEFAULT '',
    recommended_action TEXT NOT NULL DEFAULT 'new-chat',
    handoff_summary TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

const defaultTriggerRules =
  "Remind me when the goal, deliverable, repository, data boundary, permissions, or long-term workstream changes.";

async function prepareDb() {
  await env.DB.batch([
    env.DB.prepare(policySchema),
    env.DB.prepare(workstreamsSchema),
    env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS conversation_workstream_owner_idx ON conversation_workstreams(owner_email)"
    ),
    env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS conversation_workstream_status_idx ON conversation_workstreams(status)"
    ),
    env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS conversation_workstream_updated_idx ON conversation_workstreams(updated_at DESC)"
    ),
  ]);
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  await prepareDb();

  const [policy, workstreams] = await Promise.all([
    env.DB.prepare("SELECT * FROM routing_policies WHERE email = ?1")
      .bind(user.email)
      .first(),
    env.DB.prepare(
      `SELECT * FROM conversation_workstreams
       WHERE owner_email = ?1
       ORDER BY updated_at DESC
       LIMIT 100`
    )
      .bind(user.email)
      .all(),
  ]);

  return NextResponse.json({
    policy: policy || {
      email: user.email,
      reminder_enabled: 1,
      trigger_rules: defaultTriggerRules,
    },
    workstreams: workstreams.results,
  });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  await prepareDb();

  const form = await request.formData();
  const action = String(form.get("action") ?? "");
  const now = new Date().toISOString();

  if (action === "policy") {
    const reminderEnabled = String(form.get("reminderEnabled") ?? "") === "on" ? 1 : 0;
    const triggerRules =
      String(form.get("triggerRules") ?? "").trim().slice(0, 4000) || defaultTriggerRules;

    await env.DB.prepare(
      `INSERT INTO routing_policies (email, reminder_enabled, trigger_rules, updated_at)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(email) DO UPDATE SET
         reminder_enabled = excluded.reminder_enabled,
         trigger_rules = excluded.trigger_rules,
         updated_at = excluded.updated_at`
    )
      .bind(user.email, reminderEnabled, triggerRules, now)
      .run();

    return NextResponse.json({ ok: true });
  }

  if (action === "workstream") {
    const projectName = String(form.get("projectName") ?? "").trim().slice(0, 180);
    const chatTitle = String(form.get("chatTitle") ?? "").trim().slice(0, 180);
    const activeGoal = String(form.get("activeGoal") ?? "").trim().slice(0, 4000);
    const deliverable = String(form.get("deliverable") ?? "").trim().slice(0, 2000);
    const shiftReason = String(form.get("shiftReason") ?? "").trim().slice(0, 2000);
    const handoffSummary = String(form.get("handoffSummary") ?? "").trim().slice(0, 8000);
    const requestedAction = String(form.get("recommendedAction") ?? "new-chat");
    const recommendedAction = ["continue", "new-chat", "new-project"].includes(requestedAction)
      ? requestedAction
      : "new-chat";

    if (!projectName || !chatTitle || !activeGoal) {
      return NextResponse.json(
        { error: "Project, chat title, and active goal are required." },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO conversation_workstreams (
        id, owner_email, project_name, chat_title, active_goal, deliverable,
        shift_reason, recommended_action, handoff_summary, status, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'active', ?10, ?10)`
    )
      .bind(
        id,
        user.email,
        projectName,
        chatTitle,
        activeGoal,
        deliverable,
        shiftReason,
        recommendedAction,
        handoffSummary,
        now
      )
      .run();

    return NextResponse.json({ id }, { status: 201 });
  }

  return NextResponse.json({ error: "Unsupported routing action." }, { status: 400 });
}
