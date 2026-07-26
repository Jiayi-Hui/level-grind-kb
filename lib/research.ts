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

export async function prepareResearchDb() {
  await env.DB.batch([
    env.DB.prepare(preferencesSchema),
    env.DB.prepare(researchQueriesSchema),
    env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS research_queries_user_created_idx ON research_queries(user_email, created_at)",
    ),
  ]);
}

export async function webSearch(question: string): Promise<WebSearchResult[]> {
  const provider = (runtimeEnv("WEB_SEARCH_PROVIDER") || "tavily").trim().toLowerCase();
  const apiKey = runtimeEnv("WEB_SEARCH_API_KEY")?.trim();
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
    detail?: string;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.detail || payload.error || "The web search provider returned an error.");
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
