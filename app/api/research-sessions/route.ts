import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "../../../lib/access";
import { prepareResearchDb, type EvidenceMode } from "../../../lib/research";

export const dynamic = "force-dynamic";

type ProjectRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type ChatRow = {
  id: string;
  project_id: string;
  title: string;
  evidence_mode: EvidenceMode;
  created_at: string;
  updated_at: string;
};

function cleanTitle(value: unknown, fallback: string) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 120) || fallback;
}

function projectPayload(row: ProjectRow) {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function chatPayload(row: ChatRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    mode: row.evidence_mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  await prepareResearchDb();

  const body = await request.json() as {
    kind?: string;
    title?: string;
    projectId?: string;
    mode?: string;
  };
  const now = new Date().toISOString();

  if (body.kind === "project") {
    const project: ProjectRow = {
      id: crypto.randomUUID(),
      title: cleanTitle(body.title, "New project"),
      created_at: now,
      updated_at: now,
    };
    await env.DB.prepare(
      `INSERT INTO research_projects (id, user_email, title, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?4)`,
    ).bind(project.id, user.email, project.title, now).run();
    return NextResponse.json({ project: projectPayload(project) }, { status: 201 });
  }

  if (body.kind === "chat") {
    const projectId = String(body.projectId ?? "").trim();
    const project = await env.DB.prepare(
      `SELECT id FROM research_projects WHERE id = ?1 AND user_email = ?2`,
    ).bind(projectId, user.email).first<{ id: string }>();
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    const mode: EvidenceMode = body.mode === "reports" || body.mode === "web" ? body.mode : "hybrid";
    const chat: ChatRow = {
      id: crypto.randomUUID(),
      project_id: projectId,
      title: cleanTitle(body.title, "New research chat"),
      evidence_mode: mode,
      created_at: now,
      updated_at: now,
    };
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO research_chats (
          id, user_email, project_id, title, evidence_mode, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`,
      ).bind(chat.id, user.email, projectId, chat.title, mode, now),
      env.DB.prepare(
        "UPDATE research_projects SET updated_at = ?1 WHERE id = ?2 AND user_email = ?3",
      ).bind(now, projectId, user.email),
    ]);
    return NextResponse.json({ chat: chatPayload(chat) }, { status: 201 });
  }

  return NextResponse.json({ error: "Unsupported session action." }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  await prepareResearchDb();
  const body = await request.json() as { kind?: string; id?: string; title?: string };
  const id = String(body.id ?? "").trim();
  const title = cleanTitle(body.title, "");
  if (!id || !title) {
    return NextResponse.json({ error: "Project or chat id and title are required." }, { status: 400 });
  }
  const now = new Date().toISOString();
  if (body.kind === "project") {
    const result = await env.DB.prepare(
      "UPDATE research_projects SET title = ?1, updated_at = ?2 WHERE id = ?3 AND user_email = ?4"
    ).bind(title, now, id, user.email).run();
    if (!result.meta.changes) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json({ id, title, updatedAt: now });
  }
  if (body.kind === "chat") {
    const result = await env.DB.prepare(
      "UPDATE research_chats SET title = ?1, updated_at = ?2 WHERE id = ?3 AND user_email = ?4"
    ).bind(title, now, id, user.email).run();
    if (!result.meta.changes) return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    return NextResponse.json({ id, title, updatedAt: now });
  }
  return NextResponse.json({ error: "Unsupported rename target." }, { status: 400 });
}
