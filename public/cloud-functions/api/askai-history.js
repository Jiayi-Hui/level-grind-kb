import { getStore } from "@edgeone/pages-blob";
import { clerkIdentity } from "./_shared-auth.js";

// AskAI histories are deliberately kept out of the shared Notes/Ideas store.
// The opaque, subject-derived key means a Clerk user can only ever address
// their own snapshot through this API.
const histories = getStore({ name: "level-grind-private-askai", consistency: "strong" });
const MAX_REQUEST_BYTES = 1_500_000;
const MAX_PROJECTS = 80;
const MAX_CHATS = 240;
const MAX_MESSAGES_PER_CHAT = 300;
const encoder = new TextEncoder();

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  },
});

function clean(value, max = 10_000) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, max);
}

function iso(value, fallback) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

async function subjectKey(subject) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`level-grind:askai:v1:${subject}`));
  return `private-askai/v1/${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}.json`;
}

function normalizeSources(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).map((source, index) => ({
    index: Number.isInteger(source?.index) ? source.index : index + 1,
    title: clean(source?.title, 300),
    url: clean(source?.url, 2000),
    snippet: clean(source?.snippet, 2000) || undefined,
  })).filter((source) => source.title && /^https?:\/\//i.test(source.url));
}

function normalizeUsage(value) {
  if (!value || typeof value !== "object") return undefined;
  const integer = (item) => Number.isFinite(Number(item)) ? Math.max(0, Math.floor(Number(item))) : 0;
  const cost = Number(value.estimatedCostUsd);
  return {
    inputTokens: integer(value.inputTokens), outputTokens: integer(value.outputTokens),
    provider: clean(value.provider, 100), model: clean(value.model, 180),
    webCredits: integer(value.webCredits), thinkingEnabled: value.thinkingEnabled === true,
    latencyMs: integer(value.latencyMs),
    ...(Number.isFinite(cost) && cost >= 0 ? { estimatedCostUsd: cost } : {}),
  };
}

function normalizeStore(value) {
  const now = new Date().toISOString();
  const raw = value && typeof value === "object" ? value : {};
  const projects = (Array.isArray(raw.projects) ? raw.projects : []).slice(0, MAX_PROJECTS).map((project) => ({
    id: clean(project?.id, 160), scope: project?.scope === "aidc" ? "aidc" : "events",
    title: clean(project?.title, 120) || "未命名研究项目",
    createdAt: iso(project?.createdAt, now), updatedAt: iso(project?.updatedAt, now),
  })).filter((project) => project.id);
  const projectIds = new Set(projects.map((project) => project.id));
  const chats = (Array.isArray(raw.chats) ? raw.chats : []).slice(0, MAX_CHATS).map((chat) => ({
    id: clean(chat?.id, 160), projectId: clean(chat?.projectId, 160),
    scope: chat?.scope === "aidc" ? "aidc" : "events",
    title: clean(chat?.title, 120) || "新研究对话",
    mode: ["context", "web", "hybrid"].includes(chat?.mode) ? chat.mode : "context",
    createdAt: iso(chat?.createdAt, now), updatedAt: iso(chat?.updatedAt, now),
    messages: (Array.isArray(chat?.messages) ? chat.messages : []).slice(-MAX_MESSAGES_PER_CHAT).map((message) => ({
      id: clean(message?.id, 160), role: message?.role === "assistant" ? "assistant" : "user",
      content: clean(message?.content, 80_000), sources: normalizeSources(message?.sources),
      usage: normalizeUsage(message?.usage), createdAt: iso(message?.createdAt, now),
    })).filter((message) => message.id && message.content),
  })).filter((chat) => chat.id && projectIds.has(chat.projectId));
  return { projects, chats };
}

async function readBody(request) {
  const raw = await request.text();
  if (encoder.encode(raw).byteLength > MAX_REQUEST_BYTES) throw new Error("HISTORY_PAYLOAD_TOO_LARGE");
  try { return JSON.parse(raw || "{}"); } catch { throw new Error("HISTORY_INVALID_JSON"); }
}

function errorResponse(error) {
  const code = error instanceof Error ? error.message : "HISTORY_UNAVAILABLE";
  if (code.startsWith("AUTH_")) return json({ error: "请重新登录后再试", code }, 401);
  if (code === "HISTORY_PAYLOAD_TOO_LARGE") return json({ error: "AskAI 历史过大，请先拆分或删除旧聊天。", code }, 413);
  if (code === "HISTORY_INVALID_JSON") return json({ error: "AskAI 历史请求格式无效。", code }, 400);
  return json({ error: "AskAI 私有历史暂时不可用。", code: "HISTORY_UNAVAILABLE" }, 503);
}

async function getHistory(actor) {
  const key = await subjectKey(actor.subject);
  const stored = await histories.get(key, { type: "json", consistency: "strong" });
  // The redundant subject check prevents a corrupted/wrong object from ever
  // being returned into another user's session.
  if (!stored || stored.subject !== actor.subject) return { store: { projects: [], chats: [] }, version: 0, migrated: false };
  return { store: normalizeStore(stored.store), version: Number(stored.version) || 0, migrated: Boolean(stored.migrations?.["local-v1"]) };
}

async function replaceHistory(actor, body, { migrate = false } = {}) {
  const key = await subjectKey(actor.subject);
  const current = await histories.get(key, { type: "json", consistency: "strong" });
  const currentVersion = current?.subject === actor.subject ? Number(current.version) || 0 : 0;
  if (migrate && currentVersion > 0) {
    return { store: normalizeStore(current.store), version: currentVersion, migrated: Boolean(current.migrations?.["local-v1"]), alreadyExists: true };
  }
  const expectedVersion = Number(body.expectedVersion);
  if (!migrate && (!Number.isInteger(expectedVersion) || expectedVersion !== currentVersion)) {
    return { conflict: true, currentVersion };
  }
  const store = normalizeStore(body.store);
  const version = currentVersion + 1;
  await histories.setJSON(key, {
    schemaVersion: 1, subject: actor.subject, version, store,
    migrations: { ...(current?.migrations || {}), ...(migrate ? { "local-v1": new Date().toISOString() } : {}) },
    updatedAt: new Date().toISOString(),
  }, { cacheControl: "no-store" });
  return { store, version, migrated: Boolean(migrate || current?.migrations?.["local-v1"]) };
}

export async function onRequestGet({ request, env }) {
  try { return json(await getHistory(await clerkIdentity(request, env))); }
  catch (error) { return errorResponse(error); }
}

export async function onRequestPost({ request, env }) {
  try {
    const actor = await clerkIdentity(request, env);
    const body = await readBody(request);
    const migrated = body.action === "migrate-local-v1";
    if (!migrated && body.action !== "replace") return json({ error: "AskAI 历史操作不支持。" }, 400);
    const result = await replaceHistory(actor, body, { migrate: migrated });
    if (result.conflict) return json({ error: "另一台设备刚更新了 AskAI 历史，请刷新后重试。", currentVersion: result.currentVersion }, 409);
    return json(result, migrated && !result.alreadyExists ? 201 : 200);
  } catch (error) { return errorResponse(error); }
}
