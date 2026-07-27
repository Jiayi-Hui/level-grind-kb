import { env } from "cloudflare:workers";
import { runtimeEnv } from "./runtime-env";

export type EvidenceMode = "reports" | "web" | "hybrid";

export type WebSearchResult = {
  index: number;
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  score?: number;
};

const preferencesSchema = `
  CREATE TABLE IF NOT EXISTS user_preferences (
    email TEXT PRIMARY KEY,
    language TEXT NOT NULL DEFAULT 'en',
    storage_quota_bytes INTEGER NOT NULL DEFAULT 5368709120,
    updated_at TEXT NOT NULL
  )
`;

const researchQueriesSchema = `
  CREATE TABLE IF NOT EXISTS research_queries (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    evidence_mode TEXT NOT NULL DEFAULT 'reports',
    citations_json TEXT NOT NULL DEFAULT '[]',
    web_results_json TEXT NOT NULL DEFAULT '[]',
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd TEXT NOT NULL DEFAULT '0',
    created_at TEXT NOT NULL
  )
`;

const researchProjectsSchema = `
  CREATE TABLE IF NOT EXISTS research_projects (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

const researchChatsSchema = `
  CREATE TABLE IF NOT EXISTS research_chats (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    evidence_mode TEXT NOT NULL DEFAULT 'hybrid',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

const researchMessagesSchema = `
  CREATE TABLE IF NOT EXISTS research_messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    citations_json TEXT NOT NULL DEFAULT '[]',
    web_results_json TEXT NOT NULL DEFAULT '[]',
    provider TEXT,
    model TEXT,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd TEXT NOT NULL DEFAULT '0',
    created_at TEXT NOT NULL
  )
`;

const webUsageEventsSchema = `
  CREATE TABLE IF NOT EXISTS web_usage_events (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    provider TEXT NOT NULL,
    search_depth TEXT NOT NULL,
    credits_estimated INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )
`;

export async function prepareResearchDb() {
  await env.DB.batch([
    env.DB.prepare(preferencesSchema),
    env.DB.prepare(researchQueriesSchema),
    env.DB.prepare(researchProjectsSchema),
    env.DB.prepare(researchChatsSchema),
    env.DB.prepare(researchMessagesSchema),
    env.DB.prepare(webUsageEventsSchema),
    env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS research_queries_user_created_idx ON research_queries(user_email, created_at)",
    ),
    env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS research_projects_user_updated_idx ON research_projects(user_email, updated_at)",
    ),
    env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS research_chats_project_updated_idx ON research_chats(user_email, project_id, updated_at)",
    ),
    env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS research_messages_chat_created_idx ON research_messages(chat_id, created_at)",
    ),
    env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS web_usage_user_created_idx ON web_usage_events(user_email, created_at)",
    ),
  ]);
}

export async function webSearch(question: string, userEmail?: string): Promise<WebSearchResult[]> {
  const provider = (runtimeEnv("WEB_SEARCH_PROVIDER") || "tavily").trim().toLowerCase();
  const apiKey = (
    runtimeEnv("TAVILY_API_KEY") ||
    runtimeEnv("WEB_SEARCH_API_KEY")
  )?.trim();
  if (!apiKey) {
    throw new Error(
      "Web search is not configured yet. Add a server-side web-search API key in Settings infrastructure.",
    );
  }
  if (provider !== "tavily") {
    throw new Error(`Unsupported web search provider: ${provider}`);
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query: question,
      search_depth: "advanced",
      topic: "general",
      max_results: 6,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
    }),
  });
  const payload = await response.json() as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      published_date?: string;
      score?: number;
    }>;
    usage?: { credits?: number };
    detail?: string;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.detail || payload.error || "The web search provider returned an error.");
  }
  if (userEmail) {
    try {
      await env.DB.prepare(
        `INSERT INTO web_usage_events (
          id, user_email, provider, search_depth, credits_estimated, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      ).bind(
        crypto.randomUUID(),
        userEmail,
        provider,
        "advanced",
        Math.max(0, Number(payload.usage?.credits || 2)),
        new Date().toISOString(),
      ).run();
    } catch {
      // Usage telemetry must never turn a successful research search into a failed answer.
    }
  }
  return (payload.results ?? [])
    .filter((result) => result.title && result.url)
    .slice(0, 6)
    .map((result, index) => ({
      index: index + 1,
      title: String(result.title),
      url: String(result.url),
      snippet: String(result.content || "").slice(0, 1600),
      publishedAt: result.published_date || undefined,
      score: result.score,
    }));
}
