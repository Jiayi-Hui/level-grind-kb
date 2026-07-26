import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "../../../lib/access";
import { prepareCorpusDb, searchTerms } from "../../../lib/corpus";
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

export async function POST(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  await prepareCorpusDb();
  const body = await request.json() as { question?: string };
  const question = String(body.question ?? "").trim().slice(0, 2000);
  if (question.length < 3) {
    return NextResponse.json({ error: "Please enter a more specific question." }, { status: 400 });
  }
  const terms = searchTerms(question);
  if (!terms.length) {
    return NextResponse.json({ error: "No searchable terms were found." }, { status: 400 });
  }
  const where = terms.map((_, index) => `LOWER(c.content) LIKE ?${index + 1}`).join(" OR ");
  const rows = await env.DB.prepare(
    `SELECT c.document_id, c.page_number, c.content, d.title, d.company_name, d.security_code
     FROM corpus_chunks c JOIN corpus_documents d ON d.id = c.document_id
     WHERE ${where} LIMIT 80`
  ).bind(...terms.map((term) => `%${term}%`)).all<SearchRow>();
  const ranked = rows.results
    .map((row) => ({
      ...row,
      score: terms.reduce((score, term) => score + (row.content.toLowerCase().includes(term) ? term.length : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  if (!ranked.length) {
    return NextResponse.json({ answer: "I could not find relevant passages in the current report library.", citations: [] });
  }

  const apiKey = runtimeEnv("AI_API_KEY");
  const provider = providerConfig();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "AI provider is not configured yet.",
        passages: ranked.map((row) => ({
          documentId: row.document_id,
          company: row.company_name,
          title: row.title,
          page: row.page_number,
          excerpt: row.content.slice(0, 420),
        })),
      },
      { status: 503 },
    );
  }

  const sources = ranked.map((row, index) =>
    `[${index + 1}] ${row.company_name} (${row.security_code}) · ${row.title} · p.${row.page_number}\n${row.content.slice(0, 5000)}`
  ).join("\n\n");
  const startedAt = Date.now();
  let status = "success";
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheHitTokens = 0;
  let cacheMissTokens = 0;
  let answer = "";
  try {
    const aiResponse = await fetch(
      `${provider.baseUrl}/chat/completions`,
      {
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
              content: "You are a financial research assistant. Answer only from the supplied report passages. Cite every material claim with [n]. If evidence is insufficient, say so clearly. Reply in the user's language.",
            },
            { role: "user", content: `Question:\n${question}\n\nReport passages:\n${sources}` },
          ],
        }),
      },
    );
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
    status = "error";
    await logUsage(
      user.email,
      provider,
      inputTokens,
      outputTokens,
      cacheHitTokens,
      cacheMissTokens,
      Date.now() - startedAt,
      status,
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
    status,
  );
  return NextResponse.json({
    answer,
    usage: {
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      model: provider.model,
      provider: provider.name,
    },
    citations: ranked.map((row, index) => ({
      index: index + 1,
      documentId: row.document_id,
      company: row.company_name,
      title: row.title,
      page: row.page_number,
    })),
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
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
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
