import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "../../../lib/access";
import { prepareCorpusDb, searchTerms } from "../../../lib/corpus";
import {
  EvidenceMode,
  prepareResearchDb,
  webSearch,
  WebSearchResult,
} from "../../../lib/research";
import { runtimeEnv } from "../../../lib/runtime-env";

export const dynamic = "force-dynamic";

type SearchRow = {
  document_id: string;
  page_number: number;
  content: string;
  title: string;
  company_name: string;
  security_code: string;
};

type ReportCitation = {
  kind: "report";
  index: number;
  documentId: string;
  company: string;
  title: string;
  page: number;
};

type WebCitation = {
  kind: "web";
  index: number;
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
};

type Citation = ReportCitation | WebCitation;

type ProviderConfig = {
  name: string;
  baseUrl: string;
  model: string;
};

function providerConfig(): ProviderConfig {
  const provider = (runtimeEnv("AI_PROVIDER") || "deepseek").trim().toLowerCase();
  const presets: Record<string, ProviderConfig> = {
    deepseek: {
      name: "DeepSeek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
    },
    zai: {
      name: "Z.AI",
      baseUrl: "https://api.z.ai/api/paas/v4",
      model: "glm-5.2",
    },
    moonshot: {
      name: "Moonshot",
      baseUrl: "https://api.moonshot.ai/v1",
      model: "kimi-k3",
    },
  };
  const preset = presets[provider] ?? presets.deepseek;
  return {
    name: runtimeEnv("AI_PROVIDER_NAME")?.trim() || preset.name,
    baseUrl: (runtimeEnv("AI_BASE_URL")?.trim() || preset.baseUrl).replace(/\/$/, ""),
    model: runtimeEnv("AI_MODEL")?.trim() || preset.model,
  };
}

function jsonArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  await prepareResearchDb();
  const rows = await env.DB.prepare(
    `SELECT id, question, answer, evidence_mode, citations_json, web_results_json,
            provider, model, input_tokens, output_tokens, estimated_cost_usd, created_at
     FROM research_queries
     WHERE user_email = ?1
     ORDER BY created_at DESC
     LIMIT 80`,
  ).bind(user.email).all<{
    id: string;
    question: string;
    answer: string;
    evidence_mode: EvidenceMode;
    citations_json: string;
    web_results_json: string;
    provider: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_usd: string;
    created_at: string;
  }>();

  return NextResponse.json({
    history: rows.results.map((row) => ({
      id: row.id,
      question: row.question,
      answer: row.answer,
      mode: row.evidence_mode,
      citations: jsonArray<Citation>(row.citations_json),
      webResults: jsonArray<WebSearchResult>(row.web_results_json),
      usage: {
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        estimatedCostUsd: Number(row.estimated_cost_usd),
        provider: row.provider,
        model: row.model,
      },
      createdAt: row.created_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  await Promise.all([prepareCorpusDb(), prepareResearchDb()]);
  const body = await request.json() as { question?: string; mode?: string };
  const question = String(body.question ?? "").trim().slice(0, 2000);
  const mode: EvidenceMode =
    body.mode === "web" || body.mode === "hybrid" ? body.mode : "reports";
  if (question.length < 3) {
    return NextResponse.json({ error: "Please enter a more specific question." }, { status: 400 });
  }

  let ranked: Array<SearchRow & { score: number }> = [];
  if (mode !== "web") {
    const terms = searchTerms(question);
    if (terms.length) {
      const where = terms.map((_, index) => `LOWER(c.content) LIKE ?${index + 1}`).join(" OR ");
      const rows = await env.DB.prepare(
        `SELECT c.document_id, c.page_number, c.content, d.title, d.company_name, d.security_code
         FROM corpus_chunks c JOIN corpus_documents d ON d.id = c.document_id
         WHERE ${where} LIMIT 80`,
      ).bind(...terms.map((term) => `%${term}%`)).all<SearchRow>();
      ranked = rows.results
        .map((row) => ({
          ...row,
          score: terms.reduce(
            (score, term) => score + (row.content.toLowerCase().includes(term) ? term.length : 0),
            0,
          ),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
    }
  }

  let rawWebResults: WebSearchResult[] = [];
  if (mode !== "reports") {
    try {
      rawWebResults = await webSearch(question);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Web search failed." },
        { status: 503 },
      );
    }
  }

  const reportCitations: ReportCitation[] = ranked.map((row, index) => ({
    kind: "report",
    index: index + 1,
    documentId: row.document_id,
    company: row.company_name,
    title: row.title,
    page: row.page_number,
  }));
  const webResults = rawWebResults.map((result, index) => ({
    ...result,
    index: ranked.length + index + 1,
  }));
  const webCitations: WebCitation[] = webResults.map((result) => ({
    kind: "web",
    index: result.index,
    title: result.title,
    url: result.url,
    snippet: result.snippet,
    publishedAt: result.publishedAt,
  }));
  const citations: Citation[] = [...reportCitations, ...webCitations];
  if (!citations.length) {
    return NextResponse.json({
      answer: "I could not find relevant evidence for this question.",
      citations: [],
      webResults: [],
    });
  }

  const apiKey = runtimeEnv("AI_API_KEY");
  const provider = providerConfig();
  if (!apiKey) {
    return NextResponse.json({ error: "AI provider is not configured yet." }, { status: 503 });
  }

  const reportSources = ranked.map((row, index) =>
    `[${index + 1}] REPORT · ${row.company_name} (${row.security_code}) · ${row.title} · p.${row.page_number}\n${row.content.slice(0, 5000)}`,
  );
  const externalSources = webResults.map((result) =>
    `[${result.index}] WEB · ${result.title}\nURL: ${result.url}${result.publishedAt ? `\nPublished: ${result.publishedAt}` : ""}\n${result.snippet}`,
  );
  const sources = [...reportSources, ...externalSources].join("\n\n");
  const startedAt = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheHitTokens = 0;
  let cacheMissTokens = 0;
  let answer = "";
  try {
    const aiResponse = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.1,
        max_tokens: Math.min(
          4000,
          Math.max(256, Number(runtimeEnv("AI_MAX_OUTPUT_TOKENS") || "1800")),
        ),
        messages: [
          {
            role: "system",
            content:
              "You are a financial research assistant. Use only the supplied evidence. Distinguish report evidence from public-web evidence, cite every material claim with [n], and say clearly when evidence is insufficient or conflicting. Use clean Markdown and reply in the user's language.",
          },
          {
            role: "user",
            content: `Evidence mode: ${mode}\nQuestion:\n${question}\n\nEvidence:\n${sources}`,
          },
        ],
      }),
    });
    const payload = await aiResponse.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        prompt_cache_hit_tokens?: number;
        prompt_cache_miss_tokens?: number;
      };
      error?: { message?: string };
    };
    if (!aiResponse.ok) throw new Error(payload.error?.message || "The AI provider returned an error.");
    answer = payload.choices?.[0]?.message?.content?.trim() || "";
    inputTokens = payload.usage?.prompt_tokens ?? 0;
    outputTokens = payload.usage?.completion_tokens ?? 0;
    cacheHitTokens = payload.usage?.prompt_cache_hit_tokens ?? 0;
    cacheMissTokens = payload.usage?.prompt_cache_miss_tokens ?? inputTokens - cacheHitTokens;
    if (!answer) throw new Error("The AI provider returned an empty answer.");
  } catch (error) {
    await logUsage(
      user.email,
      provider,
      inputTokens,
      outputTokens,
      cacheHitTokens,
      cacheMissTokens,
      Date.now() - startedAt,
      "error",
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI request failed." },
      { status: 502 },
    );
  }

  const estimatedCostUsd = await logUsage(
    user.email,
    provider,
    inputTokens,
    outputTokens,
    cacheHitTokens,
    cacheMissTokens,
    Date.now() - startedAt,
    "success",
  );
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO research_queries (
      id, user_email, question, answer, evidence_mode, citations_json,
      web_results_json, provider, model, input_tokens, output_tokens,
      estimated_cost_usd, created_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
  ).bind(
    id,
    user.email,
    question,
    answer,
    mode,
    JSON.stringify(citations),
    JSON.stringify(webResults),
    provider.name,
    provider.model,
    inputTokens,
    outputTokens,
    estimatedCostUsd.toFixed(8),
    createdAt,
  ).run();

  return NextResponse.json({
    id,
    question,
    answer,
    mode,
    usage: {
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      model: provider.model,
      provider: provider.name,
    },
    citations,
    webResults,
    createdAt,
  });
}

async function logUsage(
  email: string,
  provider: ProviderConfig,
  inputTokens: number,
  outputTokens: number,
  cacheHitTokens: number,
  cacheMissTokens: number,
  latencyMs: number,
  status: string,
) {
  const inputPrice = Number(runtimeEnv("AI_INPUT_USD_PER_MTOK") || "0");
  const cachedInputPrice = Number(runtimeEnv("AI_CACHED_INPUT_USD_PER_MTOK") || inputPrice);
  const outputPrice = Number(runtimeEnv("AI_OUTPUT_USD_PER_MTOK") || "0");
  const pricedInputTokens = Math.max(0, cacheMissTokens);
  const pricedCachedTokens = Math.max(0, Math.min(cacheHitTokens, inputTokens));
  const cost = (
    pricedInputTokens * inputPrice +
    pricedCachedTokens * cachedInputPrice +
    outputTokens * outputPrice
  ) / 1_000_000;
  await env.DB.prepare(
    `INSERT INTO ai_usage_events (
      id, user_email, provider, model, input_tokens, output_tokens,
      estimated_cost_usd, latency_ms, status, created_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
  ).bind(
    crypto.randomUUID(),
    email,
    provider.name,
    provider.model,
    inputTokens,
    outputTokens,
    cost.toFixed(8),
    latencyMs,
    status,
    new Date().toISOString(),
  ).run();
  return cost;
}
