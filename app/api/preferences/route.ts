import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "../../../lib/access";
import { prepareCorpusDb } from "../../../lib/corpus";
import { prepareResearchDb } from "../../../lib/research";
import { runtimeEnv } from "../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  await Promise.all([prepareResearchDb(), prepareCorpusDb()]);

  const defaultQuota = user.role === "owner" ? 21_474_836_480 : 5_368_709_120;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO user_preferences (email, language, storage_quota_bytes, updated_at)
     VALUES (?1, 'en', ?2, ?3)
     ON CONFLICT(email) DO NOTHING`,
  ).bind(user.email, defaultQuota, now).run();

  const [preference, personalStorage, sharedStorage] = await Promise.all([
    env.DB.prepare(
      "SELECT language, storage_quota_bytes FROM user_preferences WHERE email = ?1",
    ).bind(user.email).first<{ language: string; storage_quota_bytes: number }>(),
    env.DB.prepare(
      `SELECT COALESCE(SUM(file_size), 0) AS used_bytes
       FROM documents WHERE author_email = ?1 AND file_size IS NOT NULL`,
    ).bind(user.email).first<{ used_bytes: number }>(),
    env.DB.prepare(
      "SELECT COALESCE(SUM(file_size), 0) AS used_bytes FROM corpus_documents",
    ).first<{ used_bytes: number }>(),
  ]);

  const quotaBytes = Number(preference?.storage_quota_bytes || defaultQuota);
  const usedBytes = Number(personalStorage?.used_bytes || 0);
  return NextResponse.json({
    language: preference?.language === "zh" ? "zh" : "en",
    storage: {
      usedBytes,
      quotaBytes,
      remainingBytes: Math.max(0, quotaBytes - usedBytes),
      sharedCorpusBytes: Number(sharedStorage?.used_bytes || 0),
    },
    integrations: {
      aiConfigured: Boolean(runtimeEnv("AI_API_KEY")),
      webSearchConfigured: Boolean(runtimeEnv("TAVILY_API_KEY") || runtimeEnv("WEB_SEARCH_API_KEY")),
      webSearchProvider: runtimeEnv("WEB_SEARCH_PROVIDER") || "tavily",
    },
  });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  await prepareResearchDb();

  const body = await request.json() as { language?: string };
  const language = body.language === "zh" ? "zh" : body.language === "en" ? "en" : null;
  if (!language) {
    return NextResponse.json({ error: "Language must be en or zh." }, { status: 400 });
  }
  const defaultQuota = user.role === "owner" ? 21_474_836_480 : 5_368_709_120;
  await env.DB.prepare(
    `INSERT INTO user_preferences (email, language, storage_quota_bytes, updated_at)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(email) DO UPDATE SET
       language = excluded.language,
       updated_at = excluded.updated_at`,
  ).bind(user.email, language, defaultQuota, new Date().toISOString()).run();
  return NextResponse.json({ ok: true, language });
}
