import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "../../../lib/access";

export const dynamic = "force-dynamic";

const membersSchema = `
  CREATE TABLE IF NOT EXISTS team_members (
    email TEXT PRIMARY KEY,
    display_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'active',
    invited_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

async function prepareDb() {
  await env.DB.batch([
    env.DB.prepare(membersSchema),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS team_members_status_idx ON team_members(status)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS team_members_role_idx ON team_members(role)"),
  ]);
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  await prepareDb();
  const members = await env.DB.prepare(
    `SELECT email, display_name, role, status, invited_by, created_at, updated_at
     FROM team_members ORDER BY
       CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
       display_name, email`
  ).all();
  return NextResponse.json({ user, members: members.results });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  if (user.role !== "owner" && user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  await prepareDb();

  const payload = await request.json() as {
    email?: string;
    displayName?: string;
    role?: string;
    status?: string;
  };
  const email = String(payload.email ?? "").trim().toLowerCase();
  const role = payload.role === "admin" ? "admin" : "member";
  const status = payload.status === "suspended" ? "suspended" : "active";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const existing = await env.DB.prepare(
    "SELECT role FROM team_members WHERE email = ?1"
  ).bind(email).first<{ role: string }>();
  if (existing?.role === "owner") {
    return NextResponse.json({ error: "The owner account cannot be changed here." }, { status: 409 });
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO team_members (email, display_name, role, status, invited_by, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
     ON CONFLICT(email) DO UPDATE SET
       display_name = excluded.display_name,
       role = excluded.role,
       status = excluded.status,
       updated_at = excluded.updated_at`
  ).bind(email, String(payload.displayName ?? "").trim().slice(0, 120), role, status, user.email, now).run();

  return NextResponse.json({ ok: true, email, role, status });
}
