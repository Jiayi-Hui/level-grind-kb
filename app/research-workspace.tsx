"use client";

import { useAuth, useClerk } from "@clerk/react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { copy, Language } from "./i18n";
import { MarkdownAnswer } from "./markdown-answer";
import { ModelWorkbench } from "./model-workbench";

type View = "inbox" | "library" | "events" | "models" | "assistant" | "settings";
type EvidenceMode = "reports" | "web" | "hybrid";

type DocumentRecord = {
  id: string;
  title: string;
  kind: "note" | "link" | "file";
  body: string;
  source_url?: string;
  author_name: string;
  author_email: string;
  project: string;
  importance: string;
  visibility: string;
  file_name?: string;
  file_size?: number;
  created_at: string;
  context_scope: "personal" | "team";
  source_system: string;
  topics: string;
  event_date?: string;
  confidence: "low" | "medium" | "high";
};

type PersonalContext = {
  email: string;
  display_name: string;
  coverage: string;
  output_preferences: string;
  working_method: string;
  private_memory: string;
};

type ContextPayload = {
  user: { email: string; name: string; role: "owner" | "admin" | "member" };
  personal: PersonalContext;
  topics: Array<{ topic: string; item_count: number; last_signal: string }>;
  counts: { personal_items: number; team_items: number; high_signals: number };
};

type TeamMember = {
  email: string;
  display_name: string;
  role: "owner" | "admin" | "member";
  status: "active" | "suspended";
};

type CorpusDocument = {
  id: string;
  security_code: string;
  company_name: string;
  title: string;
  document_type: string;
  published_at: string;
  source_url: string;
  file_name: string;
  file_size: number;
  page_count: number;
};

type CorpusPayload = {
  documents: CorpusDocument[];
  usage: {
    query_count: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_usd: number;
  };
  memberUsage: Array<{
    user_email: string;
    query_count: number;
    total_tokens: number;
    estimated_cost_usd: number;
  }>;
};

type ResearchEvent = {
  id: string;
  title: string;
  event_type: string;
  event_date?: string;
  effective_period?: string;
  company?: string;
  ticker?: string;
  sector?: string;
  geography?: string;
  summary: string;
  event_nature: "actual" | "forecast" | "rumor";
  impact_type: "fundamental" | "market";
  impact_direction: "positive" | "negative" | "mixed" | "neutral";
  priority: "P0" | "P1" | "P2";
  verification_status: "unverified" | "partially_verified" | "confirmed" | "denied" | "expired";
  verification_kind: "candidate" | "internal" | "public" | "mixed";
  verification_summary?: string;
  confidence: "low" | "medium" | "high";
  metric_name?: string;
  metric_object?: string;
  expected_value?: string;
  actual_value?: string;
  unit?: string;
  supplier?: string;
  customer?: string;
  product?: string;
  date_precision?: string;
  source_class?: string;
  source_week?: string;
  source_locator?: string;
  raw_claim?: string;
  verification_plan?: string;
  pm_relevance?: string;
  analyst_notes?: string;
  source_system: string;
  source_title?: string;
  source_url?: string;
  source_excerpt?: string;
  verification_sources_json: string;
  tags_json: string;
  claim_count: number;
  notice_count: number;
  latest_notice_type?: string;
  latest_notice_summary?: string;
  latest_claim_text?: string;
  latest_claim_speaker?: string;
  latest_claimed_at?: string;
  latest_claim_source_system?: string;
  latest_claim_source_title?: string;
  latest_claim_verification_status?: string;
};

type EventsPayload = {
  events: ResearchEvent[];
  stats: Array<{ event_type: string; count: number }>;
  attention: {
    claim_count: number;
    unverified_claim_count: number;
    notice_count: number;
  };
};

type ResearchClaim = {
  id: string;
  claim_text: string;
  claim_type: "fact" | "forecast" | "rumor" | "estimate" | "interpretation" | "denial";
  claimed_at?: string;
  speaker?: string;
  company?: string;
  ticker?: string;
  source_system: string;
  source_title?: string;
  source_url?: string;
  source_locator?: string;
  source_excerpt?: string;
  verification_status: "unverified" | "source_verified" | "misquoted" | "retracted";
  verification_kind: "candidate" | "internal" | "public" | "mixed";
  confidence: "low" | "medium" | "high";
  event_ids?: string;
  relations?: string;
};

type ClaimsPayload = {
  claims: ResearchClaim[];
  stats: Array<{ claim_type: string; count: number }>;
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

type WebResult = {
  index: number;
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  score?: number;
};

type AskResult = {
  id?: string;
  question?: string;
  answer: string;
  mode?: EvidenceMode;
  createdAt?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    model: string;
    provider: string;
  };
  citations: Array<ReportCitation | WebCitation | InternalCitation>;
  webResults: WebResult[];
};

type ResearchProject = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type ResearchChat = {
  id: string;
  projectId: string;
  title: string;
  mode: EvidenceMode;
  createdAt: string;
  updatedAt: string;
};

type ChatMessage = {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  citations: Array<ReportCitation | WebCitation | InternalCitation>;
  webResults: WebResult[];
  usage?: AskResult["usage"];
  createdAt: string;
};

type AskPayload = {
  history: AskResult[];
  projects: ResearchProject[];
  chats: ResearchChat[];
  activeChatId: string | null;
  messages: ChatMessage[];
};

type PreferencesPayload = {
  language: Language;
  storage: {
    usedBytes: number;
    quotaBytes: number;
    remainingBytes: number;
    sharedCorpusBytes: number;
  };
  integrations: {
    aiConfigured: boolean;
    webSearchConfigured: boolean;
    webSearchProvider: string;
  };
};

const navIcons: Record<View, string> = {
  inbox: "⌂",
  library: "▤",
  events: "◇",
  models: "▦",
  assistant: "✦",
  settings: "⚙",
};

const eventTypeLabels: Record<Language, Record<string, string>> = {
  en: {
    EARNINGS: "Earnings",
    GUIDANCE: "Guidance",
    CAPITAL_ALLOCATION: "Capex / FCF",
    OPERATING_KPI: "Operating KPI",
    PRODUCT_TECH_MILESTONE: "Product / tech",
    ORDER_SUPPLY: "Orders / supply",
    POLICY_REGULATION: "Policy",
    MARKET_STRUCTURE: "Market structure",
  },
  zh: {
    EARNINGS: "业绩",
    GUIDANCE: "指引",
    CAPITAL_ALLOCATION: "资本开支 / 现金流",
    OPERATING_KPI: "经营数据",
    PRODUCT_TECH_MILESTONE: "产品 / 技术",
    ORDER_SUPPLY: "订单 / 供应",
    POLICY_REGULATION: "政策",
    MARKET_STRUCTURE: "市场变化",
  },
};

function exactDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return "";
  return value.slice(0, 10);
}

function cleanEventSummary(event: ResearchEvent) {
  const summary = event.source_excerpt || event.raw_claim || event.summary || "";
  if (/^Candidate event:.*Requires .* verification/i.test(summary)) return "";
  return summary;
}

function verificationLabel(status: ResearchEvent["verification_status"], language: Language) {
  const labels = {
    en: {
      unverified: "Unverified",
      partially_verified: "Partially verified",
      confirmed: "Confirmed",
      denied: "Denied",
      expired: "Expired",
    },
    zh: {
      unverified: "待验证",
      partially_verified: "部分验证",
      confirmed: "已确认",
      denied: "已否定",
      expired: "已失效",
    },
  } as const;
  return labels[language][status];
}

function claimTypeLabel(type: ResearchClaim["claim_type"], language: Language) {
  const labels = {
    en: {
      fact: "Statement",
      forecast: "Forecast",
      rumor: "Rumor",
      estimate: "Estimate",
      interpretation: "Interpretation",
      denial: "Denial",
    },
    zh: {
      fact: "事实陈述",
      forecast: "预测",
      rumor: "传闻",
      estimate: "估算",
      interpretation: "解读",
      denial: "否认",
    },
  } as const;
  return labels[language][type];
}

function claimVerificationLabel(status: ResearchClaim["verification_status"], language: Language) {
  const labels = {
    en: {
      unverified: "Unverified",
      source_verified: "Source checked",
      misquoted: "Misquoted",
      retracted: "Retracted",
    },
    zh: {
      unverified: "待核实",
      source_verified: "来源已核对",
      misquoted: "转述有误",
      retracted: "已撤回",
    },
  } as const;
  return labels[language][status];
}

function speakerLabel(value: string | undefined) {
  if (!value) return "";
  if (value === "Team" || value === "Verification pass") return "";
  return value;
}

function sourceSystemLabel(value: string | undefined) {
  if (!value) return "";
  if (/^(team|wechat|wechat-group)$/i.test(value)) return "WeChat Group";
  if (/^(bbg|bloomberg)$/i.test(value)) return "Bloomberg";
  return value;
}

function bytes(value: number) {
  if (value >= 1_073_741_824) return `${(value / 1_073_741_824).toFixed(1)} GB`;
  if (value >= 1_048_576) return `${(value / 1_048_576).toFixed(1)} MB`;
  return `${Math.max(0, value / 1024).toFixed(1)} KB`;
}

function materialMarkdown(doc: DocumentRecord) {
  return `---
id: ${doc.id}
title: "${doc.title.replaceAll('"', '\\"')}"
author: "${doc.author_name}"
created: ${doc.created_at}
project: "${doc.project}"
scope: ${doc.context_scope}
source: "${doc.source_system}"
source_url: ${doc.source_url || ""}
---

# ${doc.title}

${doc.body || ""}
`;
}

function answerMarkdown(result: AskResult) {
  const sourceLines = result.citations.map((citation) => {
    if (citation.kind === "web") return `${citation.index}. [${citation.title}](${citation.url})`;
    if (citation.kind === "report") return `${citation.index}. ${citation.company} · ${citation.title} · p.${citation.page}`;
    if (citation.kind === "knowledge" || citation.kind === "event") {
      return `${citation.index}. ${citation.kind === "knowledge" ? "Knowledge" : "Event"} · ${citation.title} · ${citation.source}`;
    }
    return "";
  }).join("\n");
  return `---
type: level-grind-research
question: "${(result.question || "").replaceAll('"', '\\"')}"
mode: ${result.mode || "reports"}
created: ${result.createdAt || new Date().toISOString()}
model: ${result.usage?.model || ""}
---

# ${result.question || "Research answer"}

${result.answer}

## Sources

${sourceLines}
`;
}

function messageAsAnswer(message: ChatMessage, question = "Research answer"): AskResult {
  return {
    id: message.id,
    question,
    answer: message.content,
    mode: undefined,
    createdAt: message.createdAt,
    usage: message.usage,
    citations: message.citations,
    webResults: message.webResults,
  };
}

export function ResearchWorkspace() {
  const { getToken, sessionId } = useAuth();
  const { signOut } = useClerk();
  const [active, setActive] = useState<View>("assistant");
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") return "en";
    return window.localStorage.getItem("lg-language") === "zh" ? "zh" : "en";
  });
  const c = copy[language];
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [context, setContext] = useState<ContextPayload | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [corpus, setCorpus] = useState<CorpusPayload | null>(null);
  const [eventsPayload, setEventsPayload] = useState<EventsPayload | null>(null);
  const [claimsPayload, setClaimsPayload] = useState<ClaimsPayload | null>(null);
  const [preferences, setPreferences] = useState<PreferencesPayload | null>(null);
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [chats, setChats] = useState<ResearchChat[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [activeChatId, setActiveChatId] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [selected, setSelected] = useState<DocumentRecord | null>(null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<EvidenceMode>("hybrid");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [eventDimension, setEventDimension] = useState<"type" | "company" | "quarter" | "sector">("type");
  const [eventDimensionFilter, setEventDimensionFilter] = useState("");
  const [claimTypeFilter, setClaimTypeFilter] = useState("");
  const [eventView, setEventView] = useState<"events" | "claims">("events");
  const [reportCompanyFilter, setReportCompanyFilter] = useState("");
  const [reportSectorFilter, setReportSectorFilter] = useState("");
  const [reportTypeFilter, setReportTypeFilter] = useState("");
  const [reportYearFilter, setReportYearFilter] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [questionDraft, setQuestionDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [asking, setAsking] = useState(false);
  const [askingSeconds, setAskingSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [composer, setComposer] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const [openingReportId, setOpeningReportId] = useState("");
  const [importProgress, setImportProgress] = useState("");
  const [savedWebUrls, setSavedWebUrls] = useState<Set<string>>(new Set());
  const [vaultName, setVaultName] = useState(() => {
    if (typeof window === "undefined") return "";
    const saved = window.localStorage.getItem("lg-obsidian-vault") || "";
    return saved === "Research" ? "" : saved;
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const authorizedFetch = useCallback(async (
    input: RequestInfo | URL,
    init: RequestInit = {},
  ) => {
    const token = await getToken();
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  }, [getToken]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setAccessDenied(false);
    try {
      const responses = await Promise.all([
        authorizedFetch("/api/documents?scope=team"),
        authorizedFetch("/api/context"),
        authorizedFetch("/api/members"),
        authorizedFetch("/api/corpus"),
        authorizedFetch("/api/events"),
        authorizedFetch("/api/preferences"),
        authorizedFetch("/api/ask"),
        authorizedFetch("/api/claims"),
      ]);
      if (responses.some((response) => response.status === 401)) {
        setAccessDenied(true);
        return;
      }
      if (responses.some((response) => !response.ok)) {
        throw new Error("The research workspace could not be loaded.");
      }
      const [documentsData, contextData, membersData, corpusData, eventsData, preferenceData, askData, claimsData] =
        await Promise.all(responses.map((response) => response.json())) as [
          { documents: DocumentRecord[] },
          ContextPayload,
          { members: TeamMember[] },
          CorpusPayload,
          EventsPayload,
          PreferencesPayload,
          AskPayload,
          ClaimsPayload,
        ];
      setDocuments(documentsData.documents ?? []);
      setContext(contextData);
      setMembers(membersData.members ?? []);
      setCorpus(corpusData);
      setEventsPayload(eventsData);
      setClaimsPayload(claimsData);
      setPreferences(preferenceData);
      setProjects(askData.projects ?? []);
      setChats(askData.chats ?? []);
      setActiveProjectId((current) =>
        (askData.projects ?? []).some((project) => project.id === current)
          ? current
          : askData.projects?.[0]?.id ?? "",
      );
      setActiveChatId((current) =>
        (askData.chats ?? []).some((chat) => chat.id === current)
          ? current
          : askData.activeChatId ?? askData.chats?.[0]?.id ?? "",
      );
      setChatMessages(askData.messages ?? []);
      const activeChat = (askData.chats ?? []).find((chat) => chat.id === askData.activeChatId);
      if (activeChat) setMode(activeChat.mode);
      setLanguage(preferenceData.language);
      setSelected((current) =>
        documentsData.documents.find((item) => item.id === current?.id) ??
        documentsData.documents[0] ??
        null,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [authorizedFetch]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!sessionId || !context) return;
    const key = `lg-welcome-${sessionId}`;
    const timer = window.setTimeout(
      () => setWelcome(window.sessionStorage.getItem(key) !== "dismissed"),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [context, sessionId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!asking) return;
    const startedAt = Date.now();
    const timer = window.setInterval(
      () => setAskingSeconds(Math.floor((Date.now() - startedAt) / 1_000)),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, [asking]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chatMessages, asking]);

  async function openChat(chatId: string) {
    setActiveChatId(chatId);
    const chat = chats.find((item) => item.id === chatId);
    if (chat) {
      setActiveProjectId(chat.projectId);
      setMode(chat.mode || "hybrid");
    }
    setError("");
    try {
      const response = await authorizedFetch(`/api/ask?chatId=${encodeURIComponent(chatId)}`);
      const payload = await response.json() as AskPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not load this chat.");
      setProjects(payload.projects ?? []);
      setChats(payload.chats ?? []);
      setChatMessages(payload.messages ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load this chat.");
    }
  }

  async function createProject() {
    const title = window.prompt(language === "zh" ? "项目名称" : "Project name");
    if (!title?.trim()) return;
    try {
      const response = await authorizedFetch("/api/research-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "project", title }),
      });
      const payload = await response.json() as { project?: ResearchProject; error?: string };
      if (!response.ok || !payload.project) throw new Error(payload.error || "Could not create project.");
      setProjects((current) => [payload.project!, ...current]);
      setActiveProjectId(payload.project.id);
      setActiveChatId("");
      setChatMessages([]);
      setToast(language === "zh" ? "项目已创建" : "Project created");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create project.");
    }
  }

  async function createChat(projectId = activeProjectId) {
    const title = window.prompt(language === "zh" ? "聊天标题" : "Chat title");
    if (!title?.trim() || !projectId) return;
    try {
      const response = await authorizedFetch("/api/research-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "chat", projectId, title, mode }),
      });
      const payload = await response.json() as { chat?: ResearchChat; error?: string };
      if (!response.ok || !payload.chat) throw new Error(payload.error || "Could not create chat.");
      setChats((current) => [payload.chat!, ...current]);
      setActiveChatId(payload.chat.id);
      setActiveProjectId(payload.chat.projectId);
      setChatMessages([]);
      setToast(language === "zh" ? "聊天已创建" : "Chat created");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create chat.");
    }
  }

  async function renameProject(project: ResearchProject) {
    const title = window.prompt(language === "zh" ? "重命名研究项目" : "Rename research project", project.title);
    if (!title?.trim() || title.trim() === project.title) return;
    try {
      const response = await authorizedFetch("/api/research-sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "project", id: project.id, title }),
      });
      const payload = await response.json() as { title?: string; updatedAt?: string; error?: string };
      if (!response.ok || !payload.title) throw new Error(payload.error || "Rename failed.");
      setProjects((current) => current.map((item) =>
        item.id === project.id ? { ...item, title: payload.title!, updatedAt: payload.updatedAt || item.updatedAt } : item
      ));
      setToast(language === "zh" ? "项目已重命名" : "Project renamed");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Rename failed.");
    }
  }

  function askAbout(kind: "knowledge" | "report" | "event", title: string, detail = "") {
    const label = kind === "knowledge"
      ? (language === "zh" ? "个人知识" : "personal knowledge")
      : kind === "report"
        ? (language === "zh" ? "报告" : "report")
        : (language === "zh" ? "事件" : "event");
    setQuestionDraft(language === "zh"
      ? `请围绕这条${label}进行分析，并结合个人知识库、事件库、报告库和公开网络交叉验证：${title}${detail ? `；${detail}` : ""}`
      : `Analyze this ${label} and cross-check it against Personal Knowledge, Event DB, Report Library, and the public web: ${title}${detail ? `; ${detail}` : ""}`);
    setMode("hybrid");
    setActive("assistant");
    window.setTimeout(() => document.querySelector<HTMLTextAreaElement>(".chat-composer textarea")?.focus(), 0);
  }

  const filteredDocuments = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return documents;
    return documents.filter((doc) =>
      [doc.title, doc.body, doc.project, doc.topics, doc.author_name]
        .some((value) => String(value || "").toLowerCase().includes(term)),
    );
  }, [documents, query]);

  const events = useMemo(() => eventsPayload?.events ?? [], [eventsPayload?.events]);
  const filteredCorpus = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (corpus?.documents ?? []).filter((doc) =>
      (!term || [doc.company_name, doc.security_code, doc.title, doc.document_type]
        .some((value) => value.toLowerCase().includes(term))) &&
      (!reportCompanyFilter || doc.company_name === reportCompanyFilter) &&
      (!reportTypeFilter || doc.document_type === reportTypeFilter) &&
      (!reportYearFilter || doc.published_at.slice(0, 4) === reportYearFilter) &&
      (!reportSectorFilter || events.some((event) => event.company === doc.company_name && event.sector === reportSectorFilter)),
    );
  }, [corpus?.documents, events, query, reportCompanyFilter, reportSectorFilter, reportTypeFilter, reportYearFilter]);

  const eventDimensionValue = useCallback((event: ResearchEvent) => {
    if (eventDimension === "company") return event.company || "";
    if (eventDimension === "sector") return event.sector || "";
    if (eventDimension === "quarter") {
      const date = exactDate(event.event_date);
      if (!date) return "";
      return `${date.slice(0, 4)} Q${Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1}`;
    }
    return event.event_type;
  }, [eventDimension]);
  const filteredEvents = useMemo(() => {
    const term = query.trim().toLowerCase();
    return events.filter((event) => {
      const matchesType = !eventTypeFilter || event.event_type === eventTypeFilter;
      const matchesDimension = !eventDimensionFilter || eventDimensionValue(event) === eventDimensionFilter;
      const matchesTerm = !term || [
        event.title,
        event.company,
        event.ticker,
        event.summary,
        event.raw_claim,
        event.pm_relevance,
        event.verification_plan,
        event.product,
        event.customer,
        event.supplier,
      ].some((value) => String(value || "").toLowerCase().includes(term));
      return matchesType && matchesDimension && matchesTerm;
    });
  }, [events, eventDimensionFilter, eventDimensionValue, eventTypeFilter, query]);

  const eventDimensionStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      const value = eventDimensionValue(event);
      if (value) counts.set(value, (counts.get(value) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [events, eventDimensionValue]);

  const reportCompanies = useMemo(() => [...new Set((corpus?.documents ?? []).map((doc) => doc.company_name))].sort(), [corpus?.documents]);
  const reportYears = useMemo(() => [...new Set((corpus?.documents ?? []).map((doc) => doc.published_at.slice(0, 4)))].sort().reverse(), [corpus?.documents]);
  const reportTypes = useMemo(() => [...new Set((corpus?.documents ?? []).map((doc) => doc.document_type))].sort(), [corpus?.documents]);
  const reportSectors = useMemo(() => [...new Set(events.map((event) => event.sector).filter(Boolean) as string[])].sort(), [events]);

  const globalSearchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return [
      ...documents.filter((item) => [item.title, item.body, item.project, item.topics].some((value) => String(value || "").toLowerCase().includes(term))).slice(0, 4).map((item) => ({ id: item.id, kind: "knowledge" as const, title: item.title, detail: item.project })),
      ...(corpus?.documents ?? []).filter((item) => [item.company_name, item.security_code, item.title].some((value) => value.toLowerCase().includes(term))).slice(0, 4).map((item) => ({ id: item.id, kind: "report" as const, title: item.company_name, detail: item.title })),
      ...events.filter((item) => [item.title, item.company, item.ticker, item.summary].some((value) => String(value || "").toLowerCase().includes(term))).slice(0, 4).map((item) => ({ id: item.id, kind: "event" as const, title: item.title, detail: item.company || item.ticker || "" })),
    ];
  }, [corpus?.documents, documents, events, query]);

  const p0Events = events.filter((event) => event.priority === "P0").length;
  const unverifiedEvents = events.filter((event) => event.verification_status === "unverified").length;
  const claims = useMemo(() => claimsPayload?.claims ?? [], [claimsPayload?.claims]);
  const filteredClaims = useMemo(() => {
    const term = query.trim().toLowerCase();
    return claims.filter((claim) => {
      const matchesType = !claimTypeFilter || claim.claim_type === claimTypeFilter;
      const matchesTerm = !term || [
        claim.claim_text,
        claim.company,
        claim.ticker,
        claim.speaker,
        claim.source_title,
        claim.source_locator,
        claim.event_ids,
      ].some((value) => String(value || "").toLowerCase().includes(term));
      return matchesType && matchesTerm;
    });
  }, [claims, claimTypeFilter, query]);

  async function switchLanguage(next: Language) {
    setLanguage(next);
    window.localStorage.setItem("lg-language", next);
    try {
      const response = await authorizedFetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: next }),
      });
      if (!response.ok) throw new Error();
      setPreferences((current) => current ? { ...current, language: next } : current);
    } catch {
      setToast(next === "zh" ? "语言已在本设备切换，云端同步稍后重试。" : "Language changed locally; cloud sync will retry later.");
    }
  }

  function dismissWelcome() {
    if (sessionId) window.sessionStorage.setItem(`lg-welcome-${sessionId}`, "dismissed");
    setWelcome(false);
  }

  async function submitMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await authorizedFetch("/api/documents", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Capture failed.");
      event.currentTarget.reset();
      setComposer(false);
      setToast(language === "zh" ? "资料已保存" : "Material saved");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Capture failed.");
    } finally {
      setSaving(false);
    }
  }

  async function importCorpus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("corpusFiles") as HTMLInputElement;
    const selectedFiles = Array.from(input.files ?? []);
    const manifestFile = selectedFiles.find((file) => file.name === "manifest.json");
    if (!manifestFile) {
      setError(language === "zh" ? "请同时选择 manifest.json 和对应 PDF。" : "Select manifest.json together with its PDF files.");
      return;
    }
    const manifest = JSON.parse(await manifestFile.text()) as {
      records: Array<{
        code: string;
        company: string;
        title: string;
        documentType: string;
        publishedAt: string;
        sourceUrl: string;
        file?: { filename?: string } | null;
      }>;
    };
    const filesByName = new Map(selectedFiles.map((file) => [file.name, file]));
    setSaving(true);
    setError("");
    let completed = 0;
    try {
      for (const record of manifest.records) {
        const filename = record.file?.filename;
        const file = filename ? filesByName.get(filename) : undefined;
        if (!file) throw new Error(`Missing PDF: ${filename || record.title}`);
        setImportProgress(`${completed + 1}/${manifest.records.length} · ${record.company}`);
        const form = new FormData();
        form.set("file", file);
        form.set("securityCode", record.code);
        form.set("companyName", record.company);
        form.set("title", record.title);
        form.set("documentType", record.documentType);
        form.set("publishedAt", record.publishedAt);
        form.set("sourceUrl", record.sourceUrl);
        const response = await authorizedFetch("/api/corpus", { method: "POST", body: form });
        const payload = await response.json() as { error?: string };
        if (!response.ok) throw new Error(payload.error || `Import failed: ${record.title}`);
        completed += 1;
      }
      event.currentTarget.reset();
      setToast(language === "zh" ? `已导入 ${completed} 份报告` : `Imported ${completed} reports`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Report import failed.");
    } finally {
      setSaving(false);
      setImportProgress("");
    }
  }

  async function askResearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const question = String(form.get("question") ?? "").trim();
    if (!question) return;
    setAskingSeconds(0);
    setAsking(true);
    setError("");
    const optimisticMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      chatId: activeChatId || "pending",
      role: "user",
      content: question,
      citations: [],
      webResults: [],
      createdAt: new Date().toISOString(),
    };
    setChatMessages((current) => [...current, optimisticMessage]);
    setQuestionDraft("");
    formElement.reset();
    try {
      const response = await authorizedFetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          mode,
          projectId: activeProjectId || projects[0]?.id,
          chatId: activeChatId || undefined,
        }),
      });
      const payload = await response.json() as AskResult & {
        error?: string;
        project?: ResearchProject;
        chat?: ResearchChat;
        userMessage?: ChatMessage;
        assistantMessage?: ChatMessage;
      };
      if (!response.ok) throw new Error(payload.error || "The research assistant could not answer.");
      if (payload.project) {
        setProjects((current) => [payload.project!, ...current.filter((item) => item.id !== payload.project!.id)]);
        setActiveProjectId(payload.project.id);
      }
      if (payload.chat) {
        setChats((current) => [payload.chat!, ...current.filter((item) => item.id !== payload.chat!.id)]);
        setActiveChatId(payload.chat.id);
        setMode(payload.chat.mode || "hybrid");
      }
      if (payload.userMessage && payload.assistantMessage) {
        setChatMessages((current) => [
          ...current.filter((item) => item.id !== optimisticMessage.id),
          payload.userMessage!,
          payload.assistantMessage!,
        ]);
      }
      const corpusResponse = await authorizedFetch("/api/corpus");
      if (corpusResponse.ok) setCorpus(await corpusResponse.json() as CorpusPayload);
    } catch (caught) {
      setChatMessages((current) => current.filter((item) => item.id !== optimisticMessage.id));
      setError(caught instanceof Error ? caught.message : "The research assistant could not answer.");
    } finally {
      setAsking(false);
      setAskingSeconds(0);
    }
  }

  async function openReport(document: CorpusDocument) {
    setOpeningReportId(document.id);
    const popup = window.open("", "_blank");
    if (!popup) {
      setError(language === "zh" ? "浏览器阻止了新窗口，请允许弹窗后重试。" : "The browser blocked the report tab. Allow pop-ups and try again.");
      setOpeningReportId("");
      return;
    }
    const openingLabel = language === "zh" ? "正在打开报告…" : "Opening report…";
    const waitingLabel = language === "zh" ? "文件准备好后会在这里显示" : "The file will appear here when it is ready";
    popup.document.open();
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${openingLabel}</title><style>
      body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f2f0e9;color:#17231f;font-family:Arial,"PingFang SC",sans-serif}
      main{width:min(420px,calc(100% - 48px));text-align:center}.spinner{width:38px;height:38px;margin:0 auto 20px;border:4px solid #d6ddd8;border-top-color:#285f4c;border-radius:50%;animation:spin .7s linear infinite}
      h1{font-size:21px;margin:0 0 8px}p{margin:0;color:#6d766f;font-size:13px}.bar{height:4px;margin-top:24px;overflow:hidden;border-radius:4px;background:#dfe4df}.bar:after{content:"";display:block;width:40%;height:100%;background:#d5683d;animation:load 1.1s ease-in-out infinite}
      @keyframes spin{to{transform:rotate(360deg)}}@keyframes load{from{transform:translateX(-120%)}to{transform:translateX(350%)}}
    </style></head><body><main><div class="spinner"></div><h1>${openingLabel}</h1><p>${waitingLabel}</p><div class="bar"></div></main></body></html>`);
    popup.document.close();
    setToast(openingLabel);
    try {
      const response = await authorizedFetch(`/api/corpus/files/${document.id}`);
      if (!response.ok) throw new Error(openingLabel);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      popup.location.replace(url);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      if (!popup.closed) {
        popup.document.body.textContent = language === "zh"
          ? "报告打开失败，请关闭此页后重试。"
          : "The report could not be opened. Close this tab and try again.";
      }
      setError(language === "zh" ? "报告打开失败，请重试。" : "The report could not be opened. Try again.");
    } finally {
      setOpeningReportId("");
    }
  }

  async function saveWebResult(result: WebResult, scope: "personal" | "team") {
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      form.set("title", result.title);
      form.set("body", result.snippet);
      form.set("sourceUrl", result.url);
      form.set("project", "Web research");
      form.set("contextScope", scope);
      form.set("sourceSystem", "web-search");
      form.set("topics", "Public web evidence");
      form.set("confidence", "medium");
      form.set("importance", "normal");
      const response = await authorizedFetch("/api/documents", { method: "POST", body: form });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not save this source.");
      setSavedWebUrls((current) => new Set(current).add(result.url));
      setToast(language === "zh" ? "网络来源已加入知识库" : "Web source saved to the knowledge base");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await authorizedFetch("/api/context", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      if (!response.ok) throw new Error("Profile could not be saved.");
      setToast(language === "zh" ? "研究偏好已更新" : "Research profile updated");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const form = new FormData(event.currentTarget);
      const response = await authorizedFetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          displayName: form.get("displayName"),
          role: form.get("role"),
          status: "active",
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Member update failed.");
      event.currentTarget.reset();
      setToast(language === "zh" ? "团队成员已保存" : "Team member saved");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Member update failed.");
    } finally {
      setSaving(false);
    }
  }

  function downloadText(markdown: string, title: string) {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title.replace(/[\\/:*?"<>|]+/g, "-")}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast(language === "zh" ? "Markdown 已导出" : "Markdown exported");
  }

  async function sendToObsidian(markdown: string, title: string) {
    await navigator.clipboard.writeText(markdown);
    const file = `Level Grind/${title}`;
    const params = new URLSearchParams({ file, clipboard: "true" });
    const selectedVault = vaultName.trim();
    if (selectedVault) params.set("vault", selectedVault);
    window.location.href = `obsidian://new?${params.toString()}`;
    setToast(language === "zh" ? "已复制并发送至 Obsidian" : "Copied and sent to Obsidian");
  }

  function saveVault() {
    const selectedVault = vaultName.trim();
    if (selectedVault) window.localStorage.setItem("lg-obsidian-vault", selectedVault);
    else window.localStorage.removeItem("lg-obsidian-vault");
    setVaultName(selectedVault);
    setToast(language === "zh"
      ? selectedVault ? "Vault 设置已保存；导出时才会打开 Obsidian" : "将使用 Obsidian 当前打开的 Vault"
      : selectedVault ? "Vault setting saved; Obsidian opens only when you export" : "The currently open Obsidian vault will be used");
  }

  function useCurrentVault() {
    setVaultName("");
    window.localStorage.removeItem("lg-obsidian-vault");
    setToast(language === "zh" ? "已改为使用 Obsidian 当前打开的 Vault" : "The currently open Obsidian vault will be used");
  }

  const heading = c.heading[active];
  const storagePercent = preferences
    ? Math.min(100, (preferences.storage.usedBytes / Math.max(1, preferences.storage.quotaBytes)) * 100)
    : 0;
  const isAdmin = context?.user.role === "owner" || context?.user.role === "admin";
  const activeProjectChats = chats.filter((chat) => chat.projectId === activeProjectId);
  const activeProject = projects.find((project) => project.id === activeProjectId);
  const activeChat = chats.find((chat) => chat.id === activeChatId);

  if (accessDenied) {
    return (
      <main className="auth-page">
        <section className="auth-card unauthorized-card">
          <p className="eyebrow">INVITATION REQUIRED</p>
          <h1>Ask the workspace owner for access.</h1>
          <p>
            You are signed in with Clerk, but this email is not an active Level
            Grind team member yet. Ask the owner/admin to add your email in
            Settings → Team Access, then refresh this page.
          </p>
          <div className="auth-actions">
            <button className="upload-button" onClick={() => void load()}>Refresh access</button>
            <button className="quiet-button" onClick={() => void signOut()}>Sign out</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell research-os">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand"><span className="brand-mark">LG</span><span>Level Grind</span></div>
        <p className="workspace-label">RESEARCH OS</p>
        <nav aria-label="Workspace navigation">
          {(Object.keys(c.nav) as View[]).map((id) => (
            <button
              key={id}
              className={active === id ? "nav-item active" : "nav-item"}
              onClick={() => { setActive(id); setMobileNav(false); }}
            >
              <span className="nav-symbol">{navIcons[id]}</span>
              {c.nav[id]}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="corpus-mini">
            <span>{c.reports}</span>
            <strong>{corpus?.documents.length || 0}</strong>
            <small>{new Set(corpus?.documents.map((doc) => doc.security_code)).size} {language === "zh" ? "家公司" : "companies"}</small>
          </div>
          <button className="profile" onClick={() => setActive("settings")}>
            <span className="avatar">{(context?.user.name || "LG").slice(0, 2).toUpperCase()}</span>
            <div><strong>{context?.user.name || "Workspace owner"}</strong><small>{context?.user.role || "private alpha"}</small></div>
            <span>›</span>
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open menu" onClick={() => setMobileNav(!mobileNav)}>☰</button>
          <div className="search global-search">
            <span>⌕</span>
            <input
              value={query}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={c.search}
            />
            <kbd>⌘ K</kbd>
            {searchFocused && query.trim() && (
              <div className="global-search-results">
                <header><strong>{language === "zh" ? "跨库搜索" : "Search across libraries"}</strong><span>{globalSearchResults.length}</span></header>
                {globalSearchResults.map((result) => (
                  <button
                    key={`${result.kind}-${result.id}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setSearchFocused(false);
                      if (result.kind === "knowledge") {
                        setActive("inbox");
                        setSelected(documents.find((item) => item.id === result.id) || null);
                      } else if (result.kind === "report") {
                        setActive("library");
                        setReportCompanyFilter(result.title);
                      } else {
                        setActive("events");
                        setEventView("events");
                        setEventDimension("company");
                        setEventDimensionFilter(result.detail);
                      }
                    }}
                  >
                    <span>{result.kind === "knowledge" ? (language === "zh" ? "个人知识" : "Knowledge") : result.kind === "report" ? (language === "zh" ? "报告" : "Report") : (language === "zh" ? "事件" : "Event")}</span>
                    <strong>{result.title}</strong><small>{result.detail}</small>
                  </button>
                ))}
                {!globalSearchResults.length && <p>{language === "zh" ? "没有匹配的知识、报告或事件。" : "No matching knowledge, reports, or events."}</p>}
              </div>
            )}
          </div>
          <div className="language-switch" aria-label="Language">
            <button className={language === "en" ? "active" : ""} onClick={() => void switchLanguage("en")}>EN</button>
            <button className={language === "zh" ? "active" : ""} onClick={() => void switchLanguage("zh")}>中</button>
          </div>
          {active !== "assistant" && (
            <button className="upload-button" onClick={() => setComposer(true)}>＋ {c.capture}</button>
          )}
        </header>

        <div className="content">
          {welcome && (
            <section className="welcome-banner">
              <div className="welcome-mark">LG</div>
              <div>
                <span>{c.whatsNew} · Research OS Alpha 0.4</span>
                <h2>{c.welcome}, {context?.user.name || ""}.</h2>
                <ul>{c.releaseItems.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <button onClick={dismissWelcome}>{c.dismiss}</button>
            </section>
          )}

          <div className="page-heading">
            <div><p className="eyebrow">{heading[0]}</p><h1>{heading[1]}</h1><p>{heading[2]}</p></div>
            <span className="system-state"><i /> {c.online}</span>
          </div>

          {error && <div className="inline-error">{error}<button onClick={() => void load()}>{c.tryAgain}</button></div>}

          {active === "inbox" && (
            <>
              <div className="metrics">
                <article><span>{c.captured}</span><strong>{documents.length}</strong><small>{c.items}</small></article>
                <article><span>{c.highSignal}</span><strong>{context?.counts.high_signals || 0}</strong><small>{language === "zh" ? "需要关注" : "need attention"}</small></article>
                <article><span>{c.topics}</span><strong>{context?.topics.length || 0}</strong><small>{language === "zh" ? "活跃研究线" : "active research lines"}</small></article>
              </div>
              <DocumentDesk
                language={language}
                loading={loading}
                documents={filteredDocuments}
                selected={selected}
                setSelected={setSelected}
                onExport={(doc) => downloadText(materialMarkdown(doc), doc.title)}
                onObsidian={(doc) => void sendToObsidian(materialMarkdown(doc), doc.title)}
                onAsk={(doc) => askAbout("knowledge", doc.title, doc.body.slice(0, 240))}
                openCapture={() => setComposer(true)}
              />
            </>
          )}

          {active === "library" && (
            <section>
              <div className="metrics">
                <article><span>{c.reports}</span><strong>{corpus?.documents.length || 0}</strong><small>{c.searchablePdfs}</small></article>
                <article><span>{c.companies}</span><strong>{new Set(corpus?.documents.map((doc) => doc.security_code)).size}</strong><small>{c.inLibrary}</small></article>
                <article><span>{c.pages}</span><strong>{corpus?.documents.reduce((sum, doc) => sum + doc.page_count, 0) || 0}</strong><small>{c.indexedPages}</small></article>
              </div>
              {isAdmin && (
                <form className="corpus-import" onSubmit={importCorpus}>
                  <div><p className="eyebrow">ADMIN IMPORT</p><h2>{c.importTitle}</h2><p>{c.importBody}</p></div>
                  <label className="file-drop">{c.chooseBatch}<input name="corpusFiles" type="file" accept=".json,.pdf" multiple required /><small>{importProgress || "CNINFO batch · 25 MB interactive limit"}</small></label>
                  <button className="upload-button" disabled={saving}>{saving ? c.importing : c.importBatch}</button>
                </form>
              )}
              <div className="library-filters" aria-label={language === "zh" ? "报告筛选" : "Report filters"}>
                <select value={reportCompanyFilter} onChange={(event) => setReportCompanyFilter(event.target.value)}><option value="">{language === "zh" ? "全部公司" : "All companies"}</option>{reportCompanies.map((company) => <option key={company}>{company}</option>)}</select>
                <select value={reportSectorFilter} onChange={(event) => setReportSectorFilter(event.target.value)}><option value="">{language === "zh" ? "全部行业" : "All sectors"}</option>{reportSectors.map((sector) => <option key={sector}>{sector}</option>)}</select>
                <select value={reportTypeFilter} onChange={(event) => setReportTypeFilter(event.target.value)}><option value="">{language === "zh" ? "全部报告类型" : "All report types"}</option>{reportTypes.map((type) => <option key={type}>{type.replaceAll("-", " ")}</option>)}</select>
                <select value={reportYearFilter} onChange={(event) => setReportYearFilter(event.target.value)}><option value="">{language === "zh" ? "全部年份" : "All years"}</option>{reportYears.map((year) => <option key={year}>{year}</option>)}</select>
                {(reportCompanyFilter || reportSectorFilter || reportTypeFilter || reportYearFilter) && <button className="quiet-button" onClick={() => { setReportCompanyFilter(""); setReportSectorFilter(""); setReportTypeFilter(""); setReportYearFilter(""); }}>{language === "zh" ? "清除" : "Clear"}</button>}
              </div>
              {!filteredCorpus.length ? (
                <div className="empty-state"><h3>{c.noReports}</h3><p>{c.noReportsBody}</p></div>
              ) : (
                <div className="corpus-grid">
                  {filteredCorpus.map((document) => (
                    <article className="corpus-card" key={document.id}>
                      <div><span className="tag">{document.security_code}</span><span>{document.document_type === "annual-report" ? c.annual : c.interim}</span></div>
                      <h3>{document.company_name}</h3>
                      <p>{document.title}</p>
                      <small>{document.page_count} {language === "zh" ? "页" : "pages"} · {(document.file_size / 1_048_576).toFixed(1)} MB</small>
                      <button className="quiet-button report-open" disabled={openingReportId === document.id} onClick={() => void openReport(document)}>
                        {openingReportId === document.id && <i className="button-spinner" />}
                        {openingReportId === document.id ? c.opening : c.openReport}
                      </button>
                      <button className="ask-context-button" onClick={() => askAbout("report", document.title, `${document.company_name} · ${document.published_at}`)}>✦ {language === "zh" ? "询问此报告" : "Ask about this"}</button>
                      {openingReportId === document.id && <div className="report-card-progress" aria-live="polite"><i /></div>}
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {active === "events" && (
            <section className="events-board">
              <div className="event-mode-switch" role="tablist" aria-label="Event database view">
                <button
                  role="tab"
                  aria-selected={eventView === "events"}
                  className={eventView === "events" ? "active" : ""}
                  onClick={() => setEventView("events")}
                >
                  {language === "zh" ? "事件时间线" : "Event timeline"}
                </button>
                <button
                  role="tab"
                  aria-selected={eventView === "claims"}
                  className={eventView === "claims" ? "active" : ""}
                  onClick={() => setEventView("claims")}
                >
                  {language === "zh" ? "说法与来源" : "Claims & sources"}
                </button>
              </div>
              <div className="metrics event-summary-metrics">
                <article><span>{language === "zh" ? "事件" : "Events"}</span><strong>{events.length}</strong><small>{p0Events} P0 · {unverifiedEvents} {language === "zh" ? "待验证" : "unverified"}</small></article>
                <article><span>{language === "zh" ? "来源说法" : "Source claims"}</span><strong>{eventsPayload?.attention.claim_count || claims.length}</strong><small>{eventsPayload?.attention.unverified_claim_count || 0} {language === "zh" ? "条待核实" : "need verification"}</small></article>
              </div>

              {eventView === "events" ? <div className="event-workbench">
                <aside className="event-filter-panel">
                  <div className="event-dimension-tabs">
                    {([
                      ["type", language === "zh" ? "事件类型" : "Type"],
                      ["company", language === "zh" ? "公司" : "Company"],
                      ["quarter", language === "zh" ? "季度" : "Quarter"],
                      ["sector", language === "zh" ? "行业" : "Sector"],
                    ] as const).map(([id, label]) => <button key={id} className={eventDimension === id ? "active" : ""} onClick={() => { setEventDimension(id); setEventDimensionFilter(""); setEventTypeFilter(""); }}>{label}</button>)}
                  </div>
                  <div className="section-title"><h2>{language === "zh" ? "多维分类" : "Explore by"}</h2><span>{eventDimensionStats.length}</span></div>
                  <button className={!eventDimensionFilter ? "event-filter active" : "event-filter"} onClick={() => { setEventDimensionFilter(""); setEventTypeFilter(""); }}>
                    <strong>{language === "zh" ? "全部" : "All"}</strong><span>{events.length}</span>
                  </button>
                  {eventDimensionStats.map(([value, count]) => (
                    <button
                      key={value}
                      className={eventDimensionFilter === value ? "event-filter active" : "event-filter"}
                      onClick={() => {
                        setEventDimensionFilter(value);
                        setEventTypeFilter(eventDimension === "type" ? value : "");
                      }}
                    >
                      <strong>{eventDimension === "type" ? eventTypeLabels[language][value] || value : value}</strong>
                      <span>{count}</span>
                    </button>
                  ))}
                  <div className="event-method-note">
                    <p className="eyebrow">METHOD</p>
                    <p>{language === "zh"
                      ? "Event 是现实世界的候选或已确认变化。验证不会把 Claim 覆盖掉；Claim 始终作为证据保留。"
                      : "Events are candidate or confirmed changes in the world. Verification never overwrites the underlying Claims; they remain as evidence."}</p>
                  </div>
                </aside>

                <div className="event-list">
                  {!filteredEvents.length ? (
                    <div className="empty-state"><h3>{language === "zh" ? "没有匹配事件" : "No matching events"}</h3><p>{language === "zh" ? "尝试其他关键词或事件类型。" : "Try a different search term or event-type filter."}</p></div>
                  ) : filteredEvents.map((event) => {
                    const eventDate = exactDate(event.event_date);
                    const claimDate = exactDate(event.latest_claimed_at);
                    const summary = cleanEventSummary(event);
                    return (
                      <article className={`event-card priority-${event.priority.toLowerCase()}`} key={event.id}>
                        <div className="event-card-top">
                          <span className="tag">{event.priority}</span>
                          <span className="tag muted-tag">{eventTypeLabels[language][event.event_type] || event.event_type}</span>
                          <span className={`verify-pill verify-${event.verification_status}`}>{verificationLabel(event.verification_status, language)}</span>
                        </div>
                        <h3>{event.title}</h3>
                        <div className="event-meta-line">
                          <span>{event.company || "Sector / macro"}</span>
                          {event.ticker && <span>{event.ticker}</span>}
                          {eventDate && <time dateTime={eventDate}>{eventDate}</time>}
                        </div>
                        {summary && <p className="event-summary">{summary}</p>}
                        {event.latest_claim_text && (
                          <p className="event-provenance">
                            <span>{language === "zh" ? "来源" : "Source"} · {sourceSystemLabel(event.latest_claim_source_system) || (language === "zh" ? "未标注" : "Not supplied")}</span>
                            {speakerLabel(event.latest_claim_speaker) && <span>{language === "zh" ? "发言人" : "Speaker"} · {speakerLabel(event.latest_claim_speaker)}</span>}
                            {claimDate && <time dateTime={claimDate}>{claimDate}</time>}
                            <q>{event.latest_claim_text}</q>
                            {event.latest_claim_verification_status === "source_verified" && sourceSystemLabel(event.latest_claim_source_title || event.latest_claim_source_system) && (
                              <small>{language === "zh" ? "核验来源" : "Verified with"} · {sourceSystemLabel(event.latest_claim_source_title || event.latest_claim_source_system)}</small>
                            )}
                          </p>
                        )}
                        <button className="ask-context-button" onClick={() => askAbout("event", event.title, `${event.company || ""} ${summary}`.trim())}>✦ {language === "zh" ? "询问此事件" : "Ask about this"}</button>
                      </article>
                    );
                  })}
                </div>
              </div> : <div className="event-workbench">
                <aside className="event-filter-panel">
                  <div className="section-title"><h2>{language === "zh" ? "说法类型" : "Claim types"}</h2><span>{claimsPayload?.stats.length || 0}</span></div>
                  <button className={!claimTypeFilter ? "event-filter active" : "event-filter"} onClick={() => setClaimTypeFilter("")}>
                    <strong>{language === "zh" ? "全部" : "All"}</strong><span>{claims.length}</span>
                  </button>
                  {(claimsPayload?.stats ?? []).map((stat) => (
                    <button
                      key={stat.claim_type}
                      className={claimTypeFilter === stat.claim_type ? "event-filter active" : "event-filter"}
                      onClick={() => setClaimTypeFilter(stat.claim_type)}
                    >
                      <strong>{stat.claim_type.replaceAll("_", " ")}</strong>
                      <span>{stat.count}</span>
                    </button>
                  ))}
                  <div className="event-method-note">
                    <p className="eyebrow">METHOD</p>
                    <p>{language === "zh"
                      ? "Claim 是某个来源的陈述、预测或解释。source verified 只说明来源和原话已核对，不代表其预测已经发生。"
                      : "A Claim is a source's statement, forecast, or interpretation. Source verified means the source was checked—not that its prediction happened."}</p>
                  </div>
                </aside>
                <div className="claim-list">
                  {!filteredClaims.length ? (
                    <div className="empty-state"><h3>{language === "zh" ? "没有匹配 Claim" : "No matching claims"}</h3><p>{language === "zh" ? "尝试其他关键词或 Claim 类型。" : "Try a different search term or claim type."}</p></div>
                  ) : filteredClaims.map((claim) => {
                    const claimDate = exactDate(claim.claimed_at);
                    const showSource = claim.source_system !== "seed-list";
                    return (
                      <article className="claim-card" key={claim.id}>
                        <div className="event-card-top">
                          <span className="tag">{claimTypeLabel(claim.claim_type, language)}</span>
                          <span className={`claim-status claim-status-${claim.verification_status}`}>{claimVerificationLabel(claim.verification_status, language)}</span>
                        </div>
                        <blockquote>{claim.claim_text}</blockquote>
                        <div className="event-meta-line">
                          <span>{language === "zh" ? "来源" : "Source"} · {sourceSystemLabel(claim.source_system)}</span>
                          {speakerLabel(claim.speaker) && <span>{language === "zh" ? "发言人" : "Speaker"} · {speakerLabel(claim.speaker)}</span>}
                          {claim.company && <span>{claim.company}</span>}
                          {claim.ticker && <span>{claim.ticker}</span>}
                          {claimDate && <time dateTime={claimDate}>{claimDate}</time>}
                        </div>
                        {claim.source_excerpt && <p className="claim-context">{claim.source_excerpt}</p>}
                        {showSource && <p className="claim-source">{claim.source_title || claim.source_system}</p>}
                      </article>
                    );
                  })}
                </div>
              </div>}
            </section>
          )}

          {active === "models" && (
            <ModelWorkbench
              language={language}
              authorizedFetch={authorizedFetch}
              onError={setError}
              onToast={setToast}
            />
          )}

          {active === "assistant" && (
            <section className="assistant-board">
              <div className="usage-strip">
                <article><span>{c.yourQueries}</span><strong>{corpus?.usage.query_count || 0}</strong></article>
                <article><span>{c.inputTokens}</span><strong>{Number(corpus?.usage.input_tokens || 0).toLocaleString()}</strong></article>
                <article><span>{c.outputTokens}</span><strong>{Number(corpus?.usage.output_tokens || 0).toLocaleString()}</strong></article>
                <article><span>{c.estCost}</span><strong>${Number(corpus?.usage.estimated_cost_usd || 0).toFixed(4)}</strong></article>
              </div>
              <div className="chat-workspace">
                <aside className="chat-sidebar">
                  <div className="chat-sidebar-head">
                    <div><p className="eyebrow">PROJECTS</p><h2>{language === "zh" ? "研究项目" : "Research projects"}</h2></div>
                    <button className="quiet-button" onClick={() => void createProject()}>＋</button>
                  </div>
                  <div className="project-list">
                    {projects.map((project) => (
                      <div key={project.id} className={project.id === activeProjectId ? "project-row-wrap active" : "project-row-wrap"}>
                        <button
                          className="project-row"
                          onClick={() => {
                          setActiveProjectId(project.id);
                          const firstChat = chats.find((chat) => chat.projectId === project.id);
                          if (firstChat) void openChat(firstChat.id);
                          else {
                            setActiveChatId("");
                            setChatMessages([]);
                          }
                          }}
                        >
                          <strong>{project.title}</strong>
                          <small>{chats.filter((chat) => chat.projectId === project.id).length} chats</small>
                        </button>
                        <button className="project-rename" aria-label={language === "zh" ? "重命名项目" : "Rename project"} title={language === "zh" ? "重命名" : "Rename"} onClick={() => void renameProject(project)}>✎</button>
                      </div>
                    ))}
                  </div>
                  <div className="chat-sidebar-head compact">
                    <div><p className="eyebrow">CHATS</p><h2>{activeProject?.title || "General"}</h2></div>
                    <button className="quiet-button" disabled={!activeProjectId} onClick={() => void createChat()}>＋</button>
                  </div>
                  <div className="chat-list">
                    {activeProjectChats.length === 0 ? (
                      <button className="project-row empty" disabled>{language === "zh" ? "还没有聊天" : "No chats yet"}</button>
                    ) : activeProjectChats.map((chat) => (
                      <button
                        key={chat.id}
                        className={chat.id === activeChatId ? "chat-row active" : "chat-row"}
                        onClick={() => void openChat(chat.id)}
                      >
                        <span className={`mode-dot mode-${chat.mode || "hybrid"}`} />
                        <strong>{chat.title}</strong>
                        <small>{new Date(chat.updatedAt).toLocaleString(language === "zh" ? "zh-CN" : "en")}</small>
                      </button>
                    ))}
                  </div>
                </aside>

                <section className="chat-panel">
                  <div className="chat-panel-head">
                    <div>
                      <p className="eyebrow">ASK AI · {mode.toUpperCase()}</p>
                      <h2>{activeChat?.title || c.askTitle}</h2>
                      <p>{language === "zh" ? "默认使用报告库 + 公开网络；每条结论都应该标注来源。" : "Hybrid is the default: report library plus public web, with sources attached to material claims."}</p>
                    </div>
                    <span>DeepSeek · Tavily</span>
                  </div>
                  <div className="chat-thread" ref={chatScrollRef}>
                    {chatMessages.length === 0 && (
                      <div className="empty-state chat-empty">
                        <h3>{language === "zh" ? "开始一个研究对话" : "Start a research chat"}</h3>
                        <p>{language === "zh" ? "可以直接问：这家公司最近的盈利预期风险是什么？系统会同时看报告库和公开网络。" : "Ask a follow-up-friendly question. The system will combine indexed reports and public web evidence."}</p>
                      </div>
                    )}
                    {chatMessages.map((message, index) => {
                      const previousUser = [...chatMessages.slice(0, index)].reverse().find((item) => item.role === "user");
                      return (
                        <article key={message.id} className={`chat-message ${message.role}`}>
                          <div className="message-avatar">{message.role === "user" ? "You" : "AI"}</div>
                          <div className="message-bubble">
                            {message.role === "assistant" ? (
                              <>
                                <MarkdownAnswer value={message.content} />
                                {(message.citations.length > 0 || message.webResults.length > 0) && (
                                  <AnswerCard
                                    result={messageAsAnswer(message, previousUser?.content || activeChat?.title || "Research answer")}
                                    language={language}
                                    corpus={corpus?.documents ?? []}
                                    savedWebUrls={savedWebUrls}
                                    saving={saving}
                                    openReport={openReport}
                                    saveWebResult={saveWebResult}
                                    onExport={() => downloadText(answerMarkdown(messageAsAnswer(message, previousUser?.content || "Level Grind research")), previousUser?.content || "Level Grind research")}
                                    onObsidian={() => void sendToObsidian(answerMarkdown(messageAsAnswer(message, previousUser?.content || "Level Grind research")), previousUser?.content || "Level Grind research")}
                                    isAdmin={Boolean(isAdmin)}
                                    compact
                                  />
                                )}
                              </>
                            ) : <p>{message.content}</p>}
                          </div>
                        </article>
                      );
                    })}
                    {asking && (
                      <article className="chat-message assistant">
                        <div className="message-avatar">AI</div>
                        <div className="message-bubble typing"><i className="button-spinner" /> {c.researching} · {askingSeconds}{language === "zh" ? " 秒" : "s"}</div>
                      </article>
                    )}
                  </div>
                  <form className="chat-composer" onSubmit={askResearch}>
                    <fieldset className="mode-picker compact">
                      <legend>{c.evidenceMode}</legend>
                      {([
                        ["hybrid", c.modeHybrid, c.modeHybridNote],
                        ["web", c.modeWeb, c.modeWebNote],
                        ["reports", c.modeReports, c.modeReportsNote],
                      ] as Array<[EvidenceMode, string, string]>).map(([id, label, note]) => (
                        <button type="button" key={id} className={mode === id ? "active" : ""} onClick={() => setMode(id)}>
                          <strong>{label}</strong><small>{note}</small>
                        </button>
                      ))}
                    </fieldset>
                    <textarea name="question" required rows={3} value={questionDraft} onChange={(event) => setQuestionDraft(event.target.value)} placeholder={c.askPlaceholder} />
                    <div className="composer-foot">
                      <span>{mode === "reports" ? c.evidenceReports : mode === "web" ? c.evidenceWeb : c.evidenceHybrid}</span>
                      <button className="upload-button" disabled={asking || (mode === "reports" && !corpus?.documents.length)}>
                        {asking && <i className="button-spinner light" />}{asking ? `${c.researching} ${askingSeconds}${language === "zh" ? "秒" : "s"}` : c.ask}
                      </button>
                    </div>
                  </form>
                </section>
              </div>
              {isAdmin && Boolean(corpus?.memberUsage.length) && (
                <section className="member-usage">
                  <div className="section-title"><h2>{language === "zh" ? "团队 AI 用量" : "Team AI usage"}</h2><span>{language === "zh" ? "运营视图" : "Operations view"}</span></div>
                  {corpus?.memberUsage.map((usage) => (
                    <article key={usage.user_email}><span>{usage.user_email}</span><b>{usage.query_count} {language === "zh" ? "次" : "queries"}</b><span>{Number(usage.total_tokens).toLocaleString()} tokens</span><span>${Number(usage.estimated_cost_usd).toFixed(4)}</span></article>
                  ))}
                </section>
              )}
            </section>
          )}


          {active === "settings" && context && (
            <section className="settings-grid">
              <article className="settings-card language-card">
                <div className="section-title"><div><p className="eyebrow">LOCALIZATION</p><h2>{c.language}</h2></div></div>
                <p>{c.languageNote}</p>
                <div className="language-cards">
                  <button className={language === "en" ? "active" : ""} onClick={() => void switchLanguage("en")}><strong>English</strong><span>EN</span></button>
                  <button className={language === "zh" ? "active" : ""} onClick={() => void switchLanguage("zh")}><strong>简体中文</strong><span>中</span></button>
                </div>
              </article>

              <article className="settings-card storage-card">
                <div className="section-title"><div><p className="eyebrow">STORAGE</p><h2>{c.storage}</h2></div><span>{bytes(preferences?.storage.remainingBytes || 0)} {c.remaining}</span></div>
                <p>{c.storageNote}</p>
                <div className="storage-meter"><i style={{ width: `${storagePercent}%` }} /></div>
                <div className="storage-numbers"><strong>{bytes(preferences?.storage.usedBytes || 0)} {c.used}</strong><span>{bytes(preferences?.storage.quotaBytes || 0)} quota</span></div>
                <div className="shared-storage"><span>{c.sharedCorpus}</span><b>{bytes(preferences?.storage.sharedCorpusBytes || 0)}</b></div>
              </article>

              <form className="settings-card profile-settings" onSubmit={saveProfile}>
                <input type="hidden" name="action" value="profile" />
                <div className="section-title"><div><p className="eyebrow">PERSONALIZATION</p><h2>{c.researchProfile}</h2></div><span>{language === "zh" ? "仅自己可编辑" : "Private to you"}</span></div>
                <p>{c.profileNote}</p>
                <label>{c.coverage}<textarea name="coverage" rows={3} defaultValue={context.personal.coverage} /></label>
                <label>{c.outputPreferences}<textarea name="outputPreferences" rows={3} defaultValue={context.personal.output_preferences} /></label>
                <label>{c.workingMethod}<textarea name="workingMethod" rows={4} defaultValue={context.personal.working_method} /></label>
                <label>{c.privateMemory}<textarea name="privateMemory" rows={4} defaultValue={context.personal.private_memory} /></label>
                <div className="composer-foot"><span>{language === "zh" ? "未来的自适应更新会保留审计记录" : "Future adaptive updates will remain auditable"}</span><button className="upload-button" disabled={saving}>{saving ? c.saving : c.saveProfile}</button></div>
              </form>

              <article className="settings-card obsidian-settings">
                <div className="section-title"><div><p className="eyebrow">LOCAL HANDOFF</p><h2>{c.obsidian}</h2></div></div>
                <p>{c.obsidianNote}</p>
                <label>{c.vaultName}<input value={vaultName} placeholder={language === "zh" ? "例如：Research Notes；留空使用当前 Vault" : "e.g. Research Notes; leave blank for current vault"} onChange={(event) => setVaultName(event.target.value)} /></label>
                <div className="obsidian-actions">
                  <button className="quiet-button" onClick={saveVault}>{c.saveLocal}</button>
                  <button className="quiet-button" onClick={useCurrentVault}>{c.useCurrentVault}</button>
                </div>
              </article>

              <article className="settings-card integration-settings">
                <div className="section-title"><div><p className="eyebrow">RESEARCH INFRA</p><h2>{language === "zh" ? "模型与联网能力" : "Model and web research"}</h2></div></div>
                <div className="integration-row">
                  <div><strong>DeepSeek</strong><small>{language === "zh" ? "回答生成与证据综合" : "Answer generation and evidence synthesis"}</small></div>
                  <span className={preferences?.integrations.aiConfigured ? "status-ready" : "status-setup"}>{preferences?.integrations.aiConfigured ? (language === "zh" ? "已连接" : "Connected") : (language === "zh" ? "待配置" : "Setup required")}</span>
                </div>
                <div className="integration-row">
                  <div><strong>{preferences?.integrations.webSearchProvider || "Tavily"} Web Search</strong><small>{language === "zh" ? "为联网和混合模式提供公开搜索结果" : "Supplies public results for Web and Hybrid modes"}</small></div>
                  <span className={preferences?.integrations.webSearchConfigured ? "status-ready" : "status-setup"}>{preferences?.integrations.webSearchConfigured ? (language === "zh" ? "已连接" : "Connected") : (language === "zh" ? "待配置 API Key" : "API key required")}</span>
                </div>
              </article>

              {isAdmin && (
                <article className="settings-card team-settings">
                  <div className="section-title"><div><p className="eyebrow">ADMIN</p><h2>{c.teamAccess}</h2></div><span>{members.filter((member) => member.status === "active").length} {c.activeMembers}</span></div>
                  <div className="member-list">
                    {members.map((member) => (
                      <div className="member-row" key={member.email}>
                        <span className="avatar">{(member.display_name || member.email).slice(0, 2).toUpperCase()}</span>
                        <div><strong>{member.display_name || member.email.split("@")[0]}</strong><small>{member.email}</small></div>
                        <span className={`member-role role-${member.role}`}>{member.role}</span>
                      </div>
                    ))}
                  </div>
                  <form className="member-form" onSubmit={saveMember}>
                    <label>{c.name}<input name="displayName" maxLength={120} /></label>
                    <label>{c.email}<input name="email" type="email" required /></label>
                    <label>{c.role}<select name="role"><option value="member">Member</option><option value="admin">Admin</option></select></label>
                    <button className="upload-button" disabled={saving}>{saving ? c.saving : c.addUpdate}</button>
                  </form>
                </article>
              )}
            </section>
          )}
        </div>
      </section>

      {composer && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setComposer(false)}>
          <form className="composer" onSubmit={submitMaterial}>
            <div className="composer-head"><div><p className="eyebrow">RESEARCH CAPTURE</p><h2>{language === "zh" ? "添加研究资料" : "Add research material"}</h2></div><button type="button" onClick={() => setComposer(false)}>×</button></div>
            <label>{language === "zh" ? "标题" : "Title"}<input name="title" required maxLength={180} autoFocus /></label>
            <label>{language === "zh" ? "笔记" : "Notes"}<textarea name="body" rows={4} /></label>
            <div className="form-grid">
              <label>{language === "zh" ? "主题 / 项目" : "Topic / project"}<input name="project" /></label>
              <label>{language === "zh" ? "可见范围" : "Scope"}<select name="contextScope"><option value="personal">{language === "zh" ? "个人" : "Personal"}</option><option value="team">{language === "zh" ? "团队" : "Team"}</option></select></label>
            </div>
            <div className="form-grid">
              <label>{language === "zh" ? "来源类型" : "Source type"}<select name="sourceSystem"><option value="manual">Manual</option><option value="wechat">WeChat</option><option value="meeting">Meeting</option><option value="filing">Company filing</option><option value="obsidian">Obsidian</option><option value="web-search">Web search</option></select></label>
              <label>{language === "zh" ? "资料日期" : "Event date"}<input name="eventDate" type="date" /></label>
            </div>
            <label>{language === "zh" ? "来源链接" : "Source link"}<input name="sourceUrl" type="url" placeholder="https://…" /></label>
            <input type="hidden" name="topics" value="" />
            <input type="hidden" name="confidence" value="medium" />
            <input type="hidden" name="importance" value="normal" />
            <input ref={fileRef} name="file" type="file" className="file-input" />
            <button className="file-drop" type="button" onClick={() => fileRef.current?.click()}>＋ {language === "zh" ? "附加 PDF、表格、图片或文档" : "Attach PDF, spreadsheet, image, or document"} <small>Up to 25 MB</small></button>
            <div className="composer-foot"><span>{language === "zh" ? "来源和范围会始终跟随资料" : "Source and scope stay attached"}</span><button className="upload-button" disabled={saving}>{saving ? c.saving : c.capture}</button></div>
          </form>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function DocumentDesk({
  language,
  loading,
  documents,
  selected,
  setSelected,
  onExport,
  onObsidian,
  onAsk,
  openCapture,
}: {
  language: Language;
  loading: boolean;
  documents: DocumentRecord[];
  selected: DocumentRecord | null;
  setSelected: (doc: DocumentRecord) => void;
  onExport: (doc: DocumentRecord) => void;
  onObsidian: (doc: DocumentRecord) => void;
  onAsk: (doc: DocumentRecord) => void;
  openCapture: () => void;
}) {
  const c = copy[language];
  return (
    <div className="desk">
      <section className="feed">
        <div className="section-title"><h2>{c.recentMaterial}</h2><span>{documents.length} {c.items}</span></div>
        {loading && <div className="state-card"><i className="button-spinner" /> {language === "zh" ? "正在加载…" : "Loading…"}</div>}
        {!loading && documents.length === 0 && <div className="empty-state"><h3>{c.emptyInbox}</h3><p>{c.emptyInboxBody}</p><button className="upload-button" onClick={openCapture}>＋ {c.capture}</button></div>}
        {!loading && documents.map((doc) => (
          <button key={doc.id} className={selected?.id === doc.id ? "feed-item selected" : "feed-item"} onClick={() => setSelected(doc)}>
            <span className={`kind-icon kind-${doc.kind}`}>{doc.kind === "file" ? "F" : doc.kind === "link" ? "↗" : "N"}</span>
            <span className="feed-main"><strong>{doc.title}</strong><small>{doc.body || doc.file_name || doc.source_url || "No preview"}</small><span className="meta"><b>{doc.topics || doc.project}</b> · {doc.source_system}</span></span>
            <span className={`scope-pill scope-${doc.context_scope}`}>{doc.context_scope}</span>
          </button>
        ))}
      </section>
      <aside className="detail">
        {selected ? (
          <>
            <div className="detail-top"><span className="tag">{selected.topics || selected.project}</span><span className={`confidence confidence-${selected.confidence}`}>{selected.confidence}</span></div>
            <h2>{selected.title}</h2>
            <p className="detail-meta">{selected.source_system} · {selected.author_name} · {new Date(selected.created_at).toLocaleDateString()}</p>
            <div className="detail-body">{selected.body || (language === "zh" ? "此资料包含附件或外部来源。" : "This item contains an attachment or external source.")}</div>
            {selected.source_url && <a className="source-link" href={selected.source_url} target="_blank" rel="noreferrer">{c.originalSource} ↗</a>}
            <div className="detail-actions"><button className="ask-context-button" onClick={() => onAsk(selected)}>✦ {language === "zh" ? "询问此内容" : "Ask about this"}</button><button onClick={() => onExport(selected)}>↓ {c.downloadMarkdown}</button><button className="obsidian-button" onClick={() => onObsidian(selected)}>{c.openObsidian} ↗</button></div>
          </>
        ) : <div className="detail-placeholder">{c.selectItem}</div>}
      </aside>
    </div>
  );
}

function AnswerCard({
  result,
  language,
  corpus,
  savedWebUrls,
  saving,
  openReport,
  saveWebResult,
  onExport,
  onObsidian,
  isAdmin,
  compact = false,
}: {
  result: AskResult;
  language: Language;
  corpus: CorpusDocument[];
  savedWebUrls: Set<string>;
  saving: boolean;
  openReport: (document: CorpusDocument) => void;
  saveWebResult: (result: WebResult, scope: "personal" | "team") => Promise<void>;
  onExport: () => void;
  onObsidian: () => void;
  isAdmin: boolean;
  compact?: boolean;
}) {
  const c = copy[language];
  return (
    <article className={`answer-card answer-card-v2 ${compact ? "compact" : ""}`}>
      <div className="section-title">
        <div><p className="eyebrow">{result.mode?.toUpperCase() || "REPORTS"}</p><h2>{result.question || c.answer}</h2></div>
        <span>{result.usage ? `${result.usage.provider} · ${result.usage.model}` : "Retrieved evidence"}</span>
      </div>
      <div className="answer-copy"><MarkdownAnswer value={result.answer} /></div>
      <div className="answer-actions"><button className="quiet-button" onClick={onExport}>↓ {c.downloadMarkdown}</button><button className="quiet-button obsidian-button" onClick={onObsidian}>{c.openObsidian} ↗</button></div>
      <div className="citation-list">
        <h3>{c.sources}</h3>
        {result.citations.map((citation) => {
          if (citation.kind === "report") {
            return <button key={`report-${citation.index}`} onClick={() => {
              const document = corpus.find((item) => item.id === citation.documentId);
              if (document) openReport(document);
            }}>
              <span>[{citation.index}]</span><strong>{citation.company} · {citation.title}</strong><small>p.{citation.page}</small>
            </button>;
          }
          if (citation.kind === "web") {
            return <a key={`web-${citation.index}`} href={citation.url} target="_blank" rel="noreferrer">
              <span>[{citation.index}]</span><strong>{citation.title}</strong><small>{new URL(citation.url).hostname} ↗</small>
            </a>;
          }
          return citation.sourceUrl
            ? <a key={`${citation.kind}-${citation.index}`} href={citation.sourceUrl} target="_blank" rel="noreferrer"><span>[{citation.index}]</span><strong>{citation.title}</strong><small>{citation.kind} · {citation.source} ↗</small></a>
            : <div className="citation-static" key={`${citation.kind}-${citation.index}`}><span>[{citation.index}]</span><strong>{citation.title}</strong><small>{citation.kind} · {citation.source}</small></div>;
        })}
      </div>
      {result.webResults.length > 0 && (
        <section className="web-results">
          <div className="section-title"><h2>{c.webEvidence}</h2><span>{result.webResults.length}</span></div>
          {result.webResults.map((webResult) => {
            const saved = savedWebUrls.has(webResult.url);
            return (
              <article key={webResult.url}>
                <div><span className="tag">WEB · {webResult.index}</span><a href={webResult.url} target="_blank" rel="noreferrer">{webResult.title} ↗</a></div>
                <p>{webResult.snippet}</p>
                <div className="web-result-actions">
                  <button className="quiet-button" disabled={saving || saved} onClick={() => void saveWebResult(webResult, "personal")}>{saved ? c.saved : c.savePersonal}</button>
                  {isAdmin && <button className="quiet-button" disabled={saving || saved} onClick={() => void saveWebResult(webResult, "team")}>{c.saveTeam}</button>}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </article>
  );
}
