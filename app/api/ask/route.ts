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

type InternalCitation = {
  kind: "knowledge" | "event";
  index: number;
  id: string;
  title: string;
  source: string;
  excerpt: string;
  sourceUrl?: string;
};

type Citation = ReportCitation | WebCitation | InternalCitation;

type ResearchProject = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type ResearchChat = {
  id: string;
  project_id: string;
  title: string;
  evidence_mode: EvidenceMode;
  created_at: string;
  updated_at: string;
};

type ResearchMessage = {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  citations_json: string;
  web_results_json: string;
  provider?: string | null;
  model?: string | null;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: string;
  created_at: string;
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

function jsonArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function titleFromQuestion(question: string) {
  return question.replace(/\s+/g, " ").trim().slice(0, 72) || "New research chat";
}

function projectPayload(row: ResearchProject) {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function chatPayload(row: ResearchChat) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    mode: row.evidence_mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function messagePayload(row: ResearchMessage) {
  return {
    id: row.id,
    chatId: row.chat_id,
    role: row.role,
    content: row.content,
    citations: jsonArray<Citation>(row.citations_json),
    webResults: jsonArray<WebSearchResult>(row.web_results_json),
    usage: row.provider && row.model ? {
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      estimatedCostUsd: Number(row.estimated_cost_usd),
      provider: row.provider,
      model: row.model,
    } : undefined,
    createdAt: row.created_at,
  };
}

async function ensureDefaultProject(email: string, title = "General research") {
  const existing = await env.DB.prepare(
    `SELECT id, title, created_at, updated_at
     FROM research_projects
     WHERE user_email = ?1
     ORDER BY updated_at DESC
     LIMIT 1`,
  ).bind(email).first<ResearchProject>();
  if (existing) return existing;

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO research_projects (id, user_email, title, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?4)`,
  ).bind(id, email, title, now).run();
  return { id, title, created_at: now, updated_at: now };
}

async function getProject(email: string, projectId?: string) {
  if (projectId) {
    const project = await env.DB.prepare(
      `SELECT id, title, created_at, updated_at
       FROM research_projects
       WHERE id = ?1 AND user_email = ?2`,
    ).bind(projectId, email).first<ResearchProject>();
    if (project) return project;
  }
  return ensureDefaultProject(email);
}

async function getOrCreateChat(email: string, projectId: string, chatId: string | undefined, question: string, mode: EvidenceMode) {
  if (chatId) {
    const chat = await env.DB.prepare(
      `SELECT id, project_id, title, evidence_mode, created_at, updated_at
       FROM research_chats
       WHERE id = ?1 AND user_email = ?2`,
    ).bind(chatId, email).first<ResearchChat>();
    if (chat) return chat;
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const title = titleFromQuestion(question);
  await env.DB.prepare(
    `INSERT INTO research_chats (
      id, user_email, project_id, title, evidence_mode, created_at, updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`,
  ).bind(id, email, projectId, title, mode, now).run();
  return { id, project_id: projectId, title, evidence_mode: mode, created_at: now, updated_at: now };
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  await prepareResearchDb();
  const selectedChatId = request.nextUrl.searchParams.get("chatId")?.trim() || "";
  const historyRows = await env.DB.prepare(
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

  const projectRows = await env.DB.prepare(
    `SELECT id, title, created_at, updated_at
     FROM research_projects
     WHERE user_email = ?1
     ORDER BY updated_at DESC
     LIMIT 40`,
  ).bind(user.email).all<ResearchProject>();
  let projects = projectRows.results;
  if (!projects.length) {
    projects = [await ensureDefaultProject(user.email)];
  }

  const chatRows = await env.DB.prepare(
    `SELECT id, project_id, title, evidence_mode, created_at, updated_at
     FROM research_chats
     WHERE user_email = ?1
     ORDER BY updated_at DESC
     LIMIT 120`,
  ).bind(user.email).all<ResearchChat>();
  const chats = chatRows.results;
  const activeChat = selectedChatId
    ? chats.find((chat) => chat.id === selectedChatId)
    : chats[0];
  const messageRows = activeChat
    ? await env.DB.prepare(
      `SELECT id, chat_id, role, content, citations_json, web_results_json,
              provider, model, input_tokens, output_tokens, estimated_cost_usd, created_at
       FROM research_messages
       WHERE chat_id = ?1 AND user_email = ?2
       ORDER BY created_at ASC
       LIMIT 120`,
    ).bind(activeChat.id, user.email).all<ResearchMessage>()
    : { results: [] as ResearchMessage[] };

  return NextResponse.json({
    projects: projects.map(projectPayload),
    chats: chats.map(chatPayload),
    activeChatId: activeChat?.id ?? null,
    messages: messageRows.results.map(messagePayload),
    history: historyRows.results.map((row) => ({
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
  const body = await request.json() as {
    question?: string;
    mode?: string;
    projectId?: string;
    chatId?: string;
  };
  const question = String(body.question ?? "").trim().slice(0, 2000);
  const mode: EvidenceMode =
    body.mode === "reports" || body.mode === "web" ? body.mode : "hybrid";
  if (question.length < 3) {
    return NextResponse.json({ error: "Please enter a more specific question." }, { status: 400 });
  }

  const project = await getProject(user.email, String(body.projectId ?? "").trim() || undefined);
  const chat = await getOrCreateChat(
    user.email,
    project.id,
    String(body.chatId ?? "").trim() || undefined,
    question,
    mode,
  );
  const askedAt = new Date().toISOString();
  const userMessageId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO research_messages (
      id, chat_id, user_email, role, content, created_at
    ) VALUES (?1, ?2, ?3, 'user', ?4, ?5)`,
  ).bind(userMessageId, chat.id, user.email, question, askedAt).run();

  let ranked: Array<SearchRow & { score: number }> = [];
  let internalEvidence: Array<{
    kind: "knowledge" | "event";
    id: string;
    title: string;
    source: string;
    excerpt: string;
    sourceUrl?: string;
  }> = [];
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
    if (mode === "hybrid" && terms.length) {
      const likeTerms = terms.slice(0, 5);
      const documentWhere = likeTerms.map((_, index) =>
        `(LOWER(d.title) LIKE ?${index + 2} OR LOWER(d.body) LIKE ?${index + 2} OR LOWER(c.topics) LIKE ?${index + 2})`
      ).join(" OR ");
      const eventWhere = likeTerms.map((_, index) =>
        `(LOWER(title) LIKE ?${index + 1} OR LOWER(summary) LIKE ?${index + 1} OR LOWER(company) LIKE ?${index + 1})`
      ).join(" OR ");
      const [knowledgeRows, eventRows] = await Promise.all([
        env.DB.prepare(
          `SELECT d.id, d.title, d.body, d.source_url, d.author_name,
                  COALESCE(c.source_system, 'manual') AS source_system
           FROM documents d LEFT JOIN document_context c ON c.document_id = d.id
           WHERE (d.visibility = 'team' OR d.author_email = ?1) AND (${documentWhere})
           ORDER BY d.updated_at DESC LIMIT 5`
        ).bind(user.email, ...likeTerms.map((term) => `%${term}%`)).all<{
          id: string; title: string; body: string; source_url?: string; author_name: string; source_system: string;
        }>(),
        env.DB.prepare(
          `SELECT id, title, summary, company, event_date, source_system, source_title
           FROM research_events WHERE ${eventWhere}
           ORDER BY COALESCE(event_date, updated_at) DESC LIMIT 5`
        ).bind(...likeTerms.map((term) => `%${term}%`)).all<{
          id: string; title: string; summary: string; company?: string; event_date?: string; source_system: string; source_title?: string;
        }>(),
      ]);
      internalEvidence = [
        ...knowledgeRows.results.map((row) => ({
          kind: "knowledge" as const,
          id: row.id,
          title: row.title,
          source: `${row.source_system} · ${row.author_name}`,
          excerpt: row.body.slice(0, 2400),
          sourceUrl: row.source_url,
        })),
        ...eventRows.results.map((row) => ({
          kind: "event" as const,
          id: row.id,
          title: row.title,
          source: [row.company, row.event_date, row.source_title || row.source_system].filter(Boolean).join(" · "),
          excerpt: row.summary.slice(0, 2400),
        })),
      ].slice(0, 8);
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
    index: ranked.length + internalEvidence.length + index + 1,
  }));
  const internalCitations: InternalCitation[] = internalEvidence.map((result, index) => ({
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
  const citations: Citation[] = [...reportCitations, ...internalCitations, ...webCitations];
  if (!citations.length) {
    const answer = "I could not find relevant evidence for this question.";
    const createdAt = new Date().toISOString();
    const assistantMessageId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO research_messages (
          id, chat_id, user_email, role, content, citations_json, web_results_json, created_at
        ) VALUES (?1, ?2, ?3, 'assistant', ?4, '[]', '[]', ?5)`,
      ).bind(assistantMessageId, chat.id, user.email, answer, createdAt),
      env.DB.prepare(
        "UPDATE research_chats SET evidence_mode = ?1, updated_at = ?2 WHERE id = ?3 AND user_email = ?4",
      ).bind(mode, createdAt, chat.id, user.email),
      env.DB.prepare(
        "UPDATE research_projects SET updated_at = ?1 WHERE id = ?2 AND user_email = ?3",
      ).bind(createdAt, project.id, user.email),
    ]);
    return NextResponse.json({
      project: projectPayload({ ...project, updated_at: createdAt }),
      chat: chatPayload({ ...chat, evidence_mode: mode, updated_at: createdAt }),
      userMessage: {
        id: userMessageId,
        chatId: chat.id,
        role: "user",
        content: question,
        citations: [],
        webResults: [],
        createdAt: askedAt,
      },
      assistantMessage: {
        id: assistantMessageId,
        chatId: chat.id,
        role: "assistant",
        content: answer,
        citations: [],
        webResults: [],
        createdAt,
      },
      question,
      answer,
      mode,
      citations: [],
      webResults: [],
      createdAt,
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
  const internalSources = internalCitations.map((result) =>
    `[${result.index}] ${result.kind.toUpperCase()} · ${result.title}\nSource: ${result.source}${result.sourceUrl ? `\nURL: ${result.sourceUrl}` : ""}\n${result.excerpt}`,
  );
  const externalSources = webResults.map((result) =>
    `[${result.index}] WEB · ${result.title}\nURL: ${result.url}${result.publishedAt ? `\nPublished: ${result.publishedAt}` : ""}\n${result.snippet}`,
  );
  const sources = [...reportSources, ...internalSources, ...externalSources].join("\n\n");
  const priorMessages = await env.DB.prepare(
    `SELECT role, content
     FROM research_messages
     WHERE chat_id = ?1 AND user_email = ?2 AND id != ?3
     ORDER BY created_at DESC
     LIMIT 8`,
  ).bind(chat.id, user.email, userMessageId).all<{ role: "user" | "assistant"; content: string }>();
  const conversationContext = priorMessages.results
    .reverse()
    .map((message) => `${message.role.toUpperCase()}: ${message.content.slice(0, 1600)}`)
    .join("\n\n");
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
              "You are a financial research chatbot for equity analysts. Use the conversation only to understand follow-up intent. Use the supplied personal/team knowledge, event, report, and public-web evidence for factual claims. Distinguish evidence types, cite every material claim with [n], and say clearly when evidence is insufficient or conflicting. Use clean Markdown and reply in the user's language.",
          },
          {
            role: "user",
            content: `Project: ${project.title}\nChat: ${chat.title}\nEvidence mode: ${mode}\n\nConversation so far:\n${conversationContext || "(new chat)"}\n\nCurrent question:\n${question}\n\nEvidence:\n${sources}`,
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
  const assistantMessageId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO research_messages (
      id, chat_id, user_email, role, content, citations_json, web_results_json,
      provider, model, input_tokens, output_tokens, estimated_cost_usd, created_at
    ) VALUES (?1, ?2, ?3, 'assistant', ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
  ).bind(
    assistantMessageId,
    chat.id,
    user.email,
    answer,
    JSON.stringify(citations),
    JSON.stringify(webResults),
    provider.name,
    provider.model,
    inputTokens,
    outputTokens,
    estimatedCostUsd.toFixed(8),
    createdAt,
  ).run();
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE research_chats SET title = CASE WHEN title = 'New research chat' THEN ?1 ELSE title END, evidence_mode = ?2, updated_at = ?3 WHERE id = ?4 AND user_email = ?5",
    ).bind(titleFromQuestion(question), mode, createdAt, chat.id, user.email),
    env.DB.prepare(
      "UPDATE research_projects SET updated_at = ?1 WHERE id = ?2 AND user_email = ?3",
    ).bind(createdAt, project.id, user.email),
  ]);
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
    project: projectPayload({ ...project, updated_at: createdAt }),
    chat: chatPayload({ ...chat, title: chat.title === "New research chat" ? titleFromQuestion(question) : chat.title, evidence_mode: mode, updated_at: createdAt }),
    userMessage: {
      id: userMessageId,
      chatId: chat.id,
      role: "user",
      content: question,
      citations: [],
      webResults: [],
      createdAt: askedAt,
    },
    assistantMessage: {
      id: assistantMessageId,
      chatId: chat.id,
      role: "assistant",
      content: answer,
      citations,
      webResults,
      usage: {
        inputTokens,
        outputTokens,
        estimatedCostUsd,
        model: provider.model,
        provider: provider.name,
      },
      createdAt,
    },
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
