import { getStore } from "@edgeone/pages-blob";
import { clerkIdentity } from "./_shared-auth.js";

const telemetry = getStore({ name: "level-grind-telemetry", consistency: "strong" });
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const managers = (env) => new Set([
  env.LEVEL_GRIND_OWNER_EMAIL,
  env.LEVEL_GRIND_MANAGER_EMAILS,
  env.LEVEL_GRIND_PRIMARY_PM_EMAIL,
  ...String(env.LEVEL_GRIND_MEMBER_MANAGER_EMAILS || "").split(","),
].map((email) => String(email || "").trim().toLowerCase()).filter(Boolean));

export async function onRequestGet({ request, env }) {
  try {
    const actor = await clerkIdentity(request, env);
    if (!managers(env).has(String(actor.email || "").toLowerCase())) return json({ error: "成员管理权限不足" }, 403);
    const url = new URL(request.url);
    const day = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("day") || "") ? url.searchParams.get("day") : new Date().toISOString().slice(0, 10);
    const listing = await telemetry.list({ prefix: `askai/${day}/`, consistency: "strong", limit: 100 });
    const requests = (await Promise.all(listing.blobs.map(({ key }) => telemetry.get(key, { type: "json", consistency: "strong" }))))
      .filter(Boolean)
      .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
      .slice(0, 50);
    return json({ day, requests, contentStored: false });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "无法读取 AskAI 诊断" }, 401);
  }
}
