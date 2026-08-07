"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { MarkdownAnswer } from "./markdown-answer";

export type ResearchScope = "all" | "notes" | "ideas" | "events" | "aidc";
type EvidenceMode = "hybrid" | "web" | "context";
type ResearchMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ index: number; title: string; url: string; snippet?: string }>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    provider: string;
    model: string;
    webCredits: number;
    thinkingEnabled?: boolean;
    latencyMs?: number;
    estimatedCostUsd?: number;
  };
  createdAt: string;
};
type ResearchProject = {
  id: string;
  scope: ResearchScope;
  title: string;
  createdAt: string;
  updatedAt: string;
};
type ResearchChat = {
  id: string;
  projectId: string;
  scope: ResearchScope;
  title: string;
  mode: EvidenceMode;
  messages: ResearchMessage[];
  createdAt: string;
  updatedAt: string;
};
export type PersonalKnowledgeNote = {
  id: string;
  title: string;
  body: string;
  scope: ResearchScope;
  projectTitle: string;
  chatTitle: string;
  sourceCount: number;
  createdAt: string;
  kind?: "answer" | "chat";
  sourceChatId?: string;
  sourceMessageId?: string;
};
type AgentStore = {
  projects: ResearchProject[];
  chats: ResearchChat[];
};
type FavoriteEnvelope = { answers: PersonalKnowledgeNote[]; chats: PersonalKnowledgeNote[] };
type HistoryResponse = { store: AgentStore; favorites?: FavoriteEnvelope; entries?: PersonalKnowledgeNote[]; version: number; migrated?: boolean; alreadyExists?: boolean; currentVersion?: number; error?: string };
type ContextEntry = {
  id: string;
  title: string;
  content: string;
};
type ModelCapability = { model: string; thinkingSupported: boolean };
type ModelProvider = "default" | "openrouter";

// Presentation-only choices verified against OpenRouter's public /api/v1/models
// catalogue on 2026-08-04. They never activate a provider or send a request
// until the authenticated server capability list contains the exact id.
const openRouterPreviewModels = [
  { model: "openai/gpt-5.6-sol", label: "GPT-5.6 Sol" },
  { model: "openai/gpt-5.6-terra", label: "GPT-5.6 Terra" },
  { model: "openai/gpt-5.6-luna", label: "GPT-5.6 Luna" },
  { model: "openai/gpt-5.5", label: "GPT-5.5" },
  { model: "anthropic/claude-opus-4.8", label: "Claude Opus 4.8" },
  { model: "z-ai/glm-5.2", label: "GLM-5.2" },
  { model: "moonshotai/kimi-k3", label: "Kimi K3" },
] as const;

const storeKey = "level-grind.agentic-research.v1";
const knowledgeKey = "level-grind.personal-knowledge.v1";
const vaultKey = "lg-obsidian-vault";
const thinkingKey = "level-grind.askai-thinking.v1";
const historyMigrationKey = "level-grind.agentic-research.remote-migrated.v1";
const researchScopes: ResearchScope[] = ["all", "notes", "ideas", "events", "aidc"];
const scopeLabels: Record<ResearchScope, string> = {
  all: "跨库研究",
  notes: "Notes库",
  ideas: "Ideas库",
  events: "事件库",
  aidc: "AI Capex",
};
const scopeProjectTitles: Record<ResearchScope, string> = {
  all: "跨库研究",
  notes: "Notes 研究",
  ideas: "Ideas 研究",
  events: "事件与价格研究",
  aidc: "AI Capex 研究",
};

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(window.localStorage.getItem(key) || "") as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function safeTitle(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 100);
}

function markdownForAnswer(
  message: ResearchMessage,
  question: string,
  projectTitle: string,
  chatTitle: string,
  scope: ResearchScope,
) {
  const sources = (message.sources || [])
    .map((source) => `[${source.index}] [${source.title}](${source.url})`)
    .join("\n");
  return [
    "---",
    `title: "${safeTitle(question || chatTitle).replace(/"/g, '\\"')}"`,
    `source: Level Grind ${scopeLabels[scope]}`,
    `project: "${projectTitle.replace(/"/g, '\\"')}"`,
    `created: ${message.createdAt}`,
    "---",
    "",
    `# ${question || chatTitle}`,
    "",
    message.content,
    sources ? `\n## Sources\n\n${sources}` : "",
  ].filter(Boolean).join("\n");
}

function markdownForChat(chat: ResearchChat, project: ResearchProject) {
  const content = chat.messages.map((message) => {
    const sources = (message.sources || []).map((source) => `[${source.index}] [${source.title}](${source.url})`).join("\n");
    return [
      `## ${message.role === "user" ? "Question" : "Answer"}`,
      "",
      message.content,
      sources ? `\n### Sources\n\n${sources}` : "",
    ].filter(Boolean).join("\n");
  }).join("\n\n---\n\n");
  return [
    "---",
    `title: "${safeTitle(chat.title).replace(/"/g, '\\"')}"`,
    `source: Level Grind ${scopeLabels[chat.scope]} AskAI`,
    `project: "${project.title.replace(/"/g, '\\"')}"`,
    `created: ${chat.createdAt}`,
    `updated: ${chat.updatedAt}`,
    "---",
    "",
    `# ${chat.title}`,
    "",
    content || "_No messages yet._",
  ].join("\n");
}

export function downloadMarkdown(markdown: string, title: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeTitle(title).replace(/[\\/:*?"<>|]+/g, "-") || "Level-Grind-research"}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function sendMarkdownToObsidian(markdown: string, title: string) {
  const params = new URLSearchParams({ file: `Level Grind/${safeTitle(title)}` });
  const vault = window.localStorage.getItem(vaultKey)?.trim();
  if (vault) params.set("vault", vault);
  try {
    await navigator.clipboard.writeText(markdown);
    params.set("clipboard", "true");
  } catch {
    params.set("content", markdown.slice(0, 14000));
  }
  window.location.href = `obsidian://new?${params.toString()}`;
}

export function loadPersonalKnowledge() {
  return readJson<PersonalKnowledgeNote[]>(knowledgeKey, []);
}

function favoriteEntries(value?: FavoriteEnvelope) {
  return [...(value?.answers || []), ...(value?.chats || [])]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function persistPersonalKnowledge(notes: PersonalKnowledgeNote[]) {
  writeJson(knowledgeKey, notes);
  window.dispatchEvent(new CustomEvent("level-grind:knowledge-updated"));
}

function savePersonalKnowledge(note: PersonalKnowledgeNote) {
  const notes = loadPersonalKnowledge();
  const next = [note, ...notes.filter((item) => item.id !== note.id)];
  persistPersonalKnowledge(next);
}

function removePersonalKnowledge(id: string) {
  persistPersonalKnowledge(loadPersonalKnowledge().filter((item) => item.id !== id));
}

function defaultProject(scope: ResearchScope): ResearchProject {
  const now = new Date().toISOString();
  return {
    id: uid(`project-${scope}`),
    scope,
    title: scopeProjectTitles[scope],
    createdAt: now,
    updatedAt: now,
  };
}

function terms(question: string) {
  return [...new Set(
    question.toLowerCase().split(/[\s,，。；;:：()（）/]+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2),
  )].slice(0, 14);
}

function rankContext(entries: ContextEntry[], question: string) {
  const needles = terms(question);
  const score = (entry: ContextEntry) => needles.reduce(
    (sum, needle) => sum + (`${entry.title} ${entry.content}`.toLowerCase().includes(needle) ? needle.length : 0),
    0,
  );
  return entries.sort((a, b) => score(b) - score(a));
}

async function eventContext(question: string): Promise<ContextEntry[]> {
  const response = await fetch("/data/claim-ledger-dashboard.json", { cache: "no-store" });
  if (!response.ok) return [];
  const payload = await response.json() as {
    claims: Array<{
      claimId: string;
      claimDateStart: string;
      claimTimeHkt?: string | null;
      speaker?: string | null;
      entity?: string | null;
      originalClaim: string;
      mappings: Array<{
        security: string;
        ticker: string;
        returns: Record<string, { return: number | null; date: string | null }>;
      }>;
    }>;
  };
  return rankContext(payload.claims.map((claim) => {
    const mapped = claim.mappings.map((mapping) => {
      const returns = ["t0", "t1", "t3", "t5"].map((horizon) => {
        const value = mapping.returns[horizon]?.return;
        return `${horizon.toUpperCase()}=${value === null || value === undefined ? "NA" : `${(value * 100).toFixed(1)}%`}`;
      }).join(", ");
      return `${mapping.security} (${mapping.ticker}): ${returns}`;
    }).join("; ");
    return {
      id: `events:${claim.claimId}`,
      title: `[Event DB] ${claim.claimDateStart} · ${claim.entity || "未标注公司"}`,
      content: [
        "Dataset: Event DB",
        `Claim: ${claim.originalClaim}`,
        `Speaker: ${claim.speaker || "unknown"}; Time: ${claim.claimTimeHkt || claim.claimDateStart}`,
        mapped ? `Observed public price windows: ${mapped}` : "No publishable price mapping.",
      ].join("\n"),
    };
  }), question);
}

async function aidcContext(question: string): Promise<ContextEntry[]> {
  const response = await fetch("/data/aidc-capex/dashboard.json", { cache: "no-store" });
  if (!response.ok) return [];
  const payload = await response.json() as {
    dataCutoff: string;
    projects: Array<{
      id: string;
      name: string;
      owner: string;
      country: string;
      address?: string | null;
      currentItMw?: number | null;
      currentH100e?: number | null;
      estimatedCapitalCostUsdBn?: number | null;
      currentChipTypes: string[];
      status: string;
      confidence: string;
      observationDate?: string | null;
      latestMilestone?: string | null;
    }>;
  };
  return rankContext(payload.projects.map((project) => ({
    id: `aidc:${project.id}`,
    title: `[AI Capex] ${project.name} · ${project.owner}`,
    content: [
      "Dataset: AI Capex",
      `Location: ${project.address || project.country}; country=${project.country}`,
      `Current IT MW=${project.currentItMw ?? "NA"}; H100e=${project.currentH100e ?? "NA"}; estimated capital cost (2025 USD bn)=${project.estimatedCapitalCostUsdBn ?? "NA"}`,
      `Chips=${project.currentChipTypes.join(", ") || "NA"}; status=${project.status}; confidence=${project.confidence}`,
      `Observation date=${project.observationDate || "unknown"}; research cutoff=${payload.dataCutoff}`,
      project.latestMilestone ? `Latest milestone: ${project.latestMilestone}` : "",
    ].filter(Boolean).join("\n"),
  })), question);
}

async function scopeContext(scope: ResearchScope, question: string): Promise<ContextEntry[]> {
  const [events, aidc] = await Promise.all([eventContext(question), aidcContext(question)]);
  const primary = scope === "aidc" ? aidc : events;
  const secondary = scope === "aidc" ? events : aidc;
  return [...primary.slice(0, 6), ...secondary.slice(0, 6)];
}

export function AgenticResearchPanel({ scope }: { scope: ResearchScope }) {
  const { getToken } = useAuth();
  const [store, setStore] = useState<AgentStore>(() => {
    const current = readJson<AgentStore>(storeKey, { projects: [], chats: [] });
    const missingScopes = researchScopes
      .filter((candidate) => !current.projects.some((project) => project.scope === candidate));
    if (!missingScopes.length) return current;
    const next = {
      ...current,
      projects: [...current.projects, ...missingScopes.map((candidate) => defaultProject(candidate))],
    };
    writeJson(storeKey, next);
    return next;
  });
  const [activeProjectId, setActiveProjectId] = useState("");
  const [activeChatId, setActiveChatId] = useState("");
  const [question, setQuestion] = useState("");
  // A fast internal answer is the default; public web search is opt-in.
  const [mode, setMode] = useState<EvidenceMode>("context");
  const [thinkingEnabled, setThinkingEnabled] = useState(() =>
    readJson<boolean>(thinkingKey, false)
  );
  const [thinkingSince, setThinkingSince] = useState<number | null>(null);
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  type StreamStage = "preparing" | "authenticated" | "retrieving_context" | "context_ready" | "retrieving_web" | "web_ready" | "connecting_provider" | "provider_connected" | "provider_streaming" | "first_token" | "complete" | "error";
  const [streamStage, setStreamStage] = useState<StreamStage>("preparing");
  const [modelProvider, setModelProvider] = useState<ModelProvider>("default");
  const [openRouterModels, setOpenRouterModels] = useState<ModelCapability[]>([]);
  const [selectedOpenRouterModel, setSelectedOpenRouterModel] = useState("");
  const [defaultModel, setDefaultModel] = useState("deepseek-v4-flash");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [favorites, setFavorites] = useState<PersonalKnowledgeNote[]>(() => loadPersonalKnowledge());
  const scrollRef = useRef<HTMLDivElement>(null);
  const remoteHistoryReady = useRef(false);
  const remoteHistoryVersion = useRef(0);
  const latestStore = useRef(store);
  const queuedHistoryWrite = useRef<number | null>(null);
  const localStoreRevision = useRef(0);
  const remoteWriteChain = useRef<Promise<void>>(Promise.resolve());
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const projects = useMemo(
    () => store.projects.filter((project) => project.scope === scope),
    [scope, store.projects],
  );
  const activeProject = projects.find((project) => project.id === activeProjectId) || projects[0];
  const chats = useMemo(
    () => store.chats.filter((chat) => chat.scope === scope && chat.projectId === activeProject?.id),
    [activeProject?.id, scope, store.chats],
  );
  const activeChat = chats.find((chat) => chat.id === activeChatId) || chats[0];
  const lastMessageContent = activeChat?.messages[activeChat.messages.length - 1]?.content;

  useEffect(() => {
    if (!thinkingSince) return;
    const update = () => setThinkingSeconds(Math.floor((Date.now() - thinkingSince) / 1000));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [thinkingSince]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeChat?.messages.length, lastMessageContent, thinkingSince]);

  // Existing browsers used localStorage. On the first authenticated visit this
  // imports that snapshot once, but never overwrites a history already written
  // from another device. The server keys it by Clerk subject, not email.
  useEffect(() => {
    let cancelled = false;
    const hydrationRevision = localStoreRevision.current;
    void (async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        const response = await fetch("/api/askai-history", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const payload = await response.json().catch(() => ({})) as HistoryResponse;
        if (!response.ok) {
          if (!cancelled) setNotice(payload.error || "AskAI 私有历史服务暂时不可用；当前继续使用本机历史。");
          return;
        }
        if (cancelled) return;
        if (payload.version > 0) {
          remoteHistoryVersion.current = payload.version;
          if (localStoreRevision.current !== hydrationRevision) {
            remoteHistoryReady.current = false;
            setNotice("云端历史载入期间已开始新对话；本机内容已保留，稍后刷新可重新同步。");
            return;
          }
          remoteHistoryReady.current = true;
          setStore(payload.store);
          writeJson(storeKey, payload.store);
          const remoteFavorites = favoriteEntries(payload.favorites);
          if (remoteFavorites.length || !loadPersonalKnowledge().length) {
            persistPersonalKnowledge(remoteFavorites);
            setFavorites(remoteFavorites);
          }
          if (payload.migrated) window.localStorage.setItem(historyMigrationKey, "done");
          return;
        }
        const local = latestStore.current;
        const migrated = await fetch("/api/askai-history", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "migrate-local-v1", store: local }),
        });
        const migratedPayload = await migrated.json().catch(() => ({})) as HistoryResponse;
        if (!migrated.ok || cancelled) {
          if (!cancelled) setNotice(migratedPayload.error || "AskAI 本机历史尚未迁移；不会删除本机记录。");
          return;
        }
        remoteHistoryVersion.current = migratedPayload.version;
        if (localStoreRevision.current !== hydrationRevision) {
          remoteHistoryReady.current = false;
          setNotice("历史迁移期间已开始新对话；本机内容已保留，未被云端快照覆盖。");
          return;
        }
        remoteHistoryReady.current = true;
        setStore(migratedPayload.store);
        writeJson(storeKey, migratedPayload.store);
        const remoteFavorites = favoriteEntries(migratedPayload.favorites);
        if (remoteFavorites.length || !loadPersonalKnowledge().length) {
          persistPersonalKnowledge(remoteFavorites);
          setFavorites(remoteFavorites);
        }
        window.localStorage.setItem(historyMigrationKey, "done");
        setNotice(migratedPayload.alreadyExists ? "已载入另一台设备上的 AskAI 私有历史" : "已将本机 AskAI 历史安全迁移到你的跨设备私有空间");
      } catch {
        if (!cancelled) setNotice("AskAI 私有历史服务暂时不可用；当前继续使用本机历史。");
      }
    })();
    return () => { cancelled = true; };
  // Hydrate once per mounted workspace. Clerk may return a new getToken
  // function identity during auth refreshes; that must not restart hydration
  // and replace a conversation the user has already begun.
  }, []);

  useEffect(() => () => {
    if (queuedHistoryWrite.current !== null) window.clearTimeout(queuedHistoryWrite.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const response = await fetch("/api/agent-chat", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { capabilities?: { defaultModel?: string; openRouter?: ModelCapability[] } };
        if (cancelled || !payload.capabilities) return;
        const models = (payload.capabilities.openRouter || []).filter((item) => item.model !== "anthropic/claude-fable-5");
        setDefaultModel(payload.capabilities.defaultModel || "deepseek-v4-flash");
        setOpenRouterModels(models);
        setSelectedOpenRouterModel((current) => (
          models.some((item) => item.model === current) || openRouterPreviewModels.some((item) => item.model === current)
            ? current
            : (models[0]?.model || "")
        ));
      } catch {
        // The default DeepSeek path remains available even when the optional
        // capabilities read cannot be reached.
      }
    })();
    return () => { cancelled = true; };
  }, [getToken]);

  const selectedOpenRouterCapability = openRouterModels.find((item) => item.model === selectedOpenRouterModel);
  const openRouterModelAvailable = modelProvider === "openrouter" && Boolean(selectedOpenRouterCapability);
  const openRouterUnavailable = modelProvider === "openrouter" && !openRouterModelAvailable;
  const thinkingAvailable = modelProvider === "default" || Boolean(selectedOpenRouterCapability?.thinkingSupported);
  useEffect(() => { latestStore.current = store; }, [store]);

  useEffect(() => {
    const refresh = () => setFavorites(loadPersonalKnowledge());
    window.addEventListener("level-grind:knowledge-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("level-grind:knowledge-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const writeRemoteHistory = useCallback(async (next: AgentStore) => {
    if (!remoteHistoryReady.current) return;
    const token = await getToken();
    if (!token) return;
    const response = await fetch("/api/askai-history", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "replace", expectedVersion: remoteHistoryVersion.current, store: next }),
    });
    const payload = await response.json().catch(() => ({})) as HistoryResponse;
    if (response.status === 409) {
      remoteHistoryReady.current = false;
      setNotice("另一台设备已更新 AskAI 历史；本机内容仍在此设备，刷新页面后可查看最新云端历史。");
      return;
    }
    if (!response.ok) {
      setNotice(payload.error || "AskAI 私有历史暂时未同步；本机仍保留当前记录。");
      return;
    }
    remoteHistoryVersion.current = payload.version;
  }, [getToken]);

  const queueRemoteHistoryWrite = useCallback((next: AgentStore) => {
    if (!remoteHistoryReady.current) return;
    latestStore.current = next;
    if (queuedHistoryWrite.current !== null) window.clearTimeout(queuedHistoryWrite.current);
    queuedHistoryWrite.current = window.setTimeout(() => {
      queuedHistoryWrite.current = null;
      remoteWriteChain.current = remoteWriteChain.current
        .catch(() => undefined)
        .then(() => writeRemoteHistory(latestStore.current));
    }, 650);
  }, [writeRemoteHistory]);

  const writeRemoteFavorite = useCallback(async (action: "favorite-answer" | "favorite-chat" | "unfavorite", note: PersonalKnowledgeNote) => {
    if (!remoteHistoryReady.current) return;
    const token = await getToken();
    if (!token) return;
    const response = await fetch("/api/askai-history", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        action,
        kind: note.kind === "chat" ? "chat" : "answer",
        id: note.id,
        favorite: action === "unfavorite" ? undefined : note,
        expectedVersion: remoteHistoryVersion.current,
      }),
    });
    const payload = await response.json().catch(() => ({})) as HistoryResponse;
    if (response.status === 409) {
      remoteHistoryReady.current = false;
      setNotice("另一台设备刚更新了收藏；本机操作已保留，刷新后可重新同步。");
      return;
    }
    if (!response.ok) {
      setNotice(payload.error || "收藏暂时只保存在本机；云端同步稍后重试。");
      return;
    }
    remoteHistoryVersion.current = payload.version;
    const entries = favoriteEntries(payload.favorites);
    persistPersonalKnowledge(entries);
    setFavorites(entries);
  }, [getToken]);

  const queueRemoteFavorite = useCallback((action: "favorite-answer" | "favorite-chat" | "unfavorite", note: PersonalKnowledgeNote) => {
    remoteWriteChain.current = remoteWriteChain.current
      .catch(() => undefined)
      .then(() => writeRemoteFavorite(action, note));
  }, [writeRemoteFavorite]);

  const commitLocalStore = (next: AgentStore) => {
    localStoreRevision.current += 1;
    latestStore.current = next;
    setStore(next);
    writeJson(storeKey, next);
  };

  const commitStore = (next: AgentStore) => {
    commitLocalStore(next);
    queueRemoteHistoryWrite(next);
  };

  const selectThinking = (enabled: boolean) => {
    setThinkingEnabled(enabled);
    writeJson(thinkingKey, enabled);
  };

  const newProject = () => {
    const title = safeTitle(window.prompt("项目名称", `新的${scopeLabels[scope]}`) || "");
    if (!title) return;
    const now = new Date().toISOString();
    const project = { id: uid("project"), scope, title, createdAt: now, updatedAt: now };
    commitStore({ ...store, projects: [project, ...store.projects] });
    setActiveProjectId(project.id);
    setActiveChatId("");
  };

  const newChat = () => {
    if (!activeProject) return;
    const now = new Date().toISOString();
    const chat: ResearchChat = {
      id: uid("chat"),
      projectId: activeProject.id,
      scope,
      title: "新研究对话",
      mode,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    commitStore({ ...store, chats: [chat, ...store.chats] });
    setActiveChatId(chat.id);
  };

  const renameProject = (project: ResearchProject) => {
    const title = safeTitle(window.prompt("重命名项目", project.title) || "");
    if (!title) return;
    commitStore({
      ...store,
      projects: store.projects.map((item) => item.id === project.id ? { ...item, title, updatedAt: new Date().toISOString() } : item),
    });
  };

  const renameChat = (chat: ResearchChat) => {
    const title = safeTitle(window.prompt("重命名聊天", chat.title) || "");
    if (!title) return;
    commitStore({
      ...store,
      chats: store.chats.map((item) => item.id === chat.id ? { ...item, title, updatedAt: new Date().toISOString() } : item),
    });
  };

  const deleteProject = (project: ResearchProject) => {
    if (!window.confirm(`删除项目“${project.title}”及其全部聊天？`)) return;
    const remainingProjects = store.projects.filter((item) => item.id !== project.id);
    const scopedRemaining = remainingProjects.filter((item) => item.scope === scope);
    const replacement = scopedRemaining.length ? null : defaultProject(scope);
    const next = {
      projects: replacement ? [replacement, ...remainingProjects] : remainingProjects,
      chats: store.chats.filter((item) => item.projectId !== project.id),
    };
    commitStore(next);
    setActiveProjectId(replacement?.id || scopedRemaining[0]?.id || "");
    setActiveChatId("");
  };

  const deleteChat = (chat: ResearchChat) => {
    if (!window.confirm(`删除聊天“${chat.title}”？`)) return;
    commitStore({ ...store, chats: store.chats.filter((item) => item.id !== chat.id) });
    setActiveChatId("");
  };

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || thinkingSince || !activeProject) return;
    if (openRouterUnavailable) {
      setError("该 OpenRouter 模型仍是待配置预览，未发送请求。请切回 DeepSeek，或等待团队在服务端批准该模型。");
      return;
    }
    setQuestion("");
    setError("");
    setNotice("");
    setThinkingSince(Date.now());
    setThinkingSeconds(0);
    setStreamStage("preparing");
    const now = new Date().toISOString();
    const currentChat: ResearchChat = activeChat || {
      id: uid("chat"),
      projectId: activeProject.id,
      scope,
      title: safeTitle(prompt).slice(0, 54),
      mode,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    const userMessage: ResearchMessage = { id: uid("message"), role: "user", content: prompt, createdAt: now };
    const optimistic = {
      ...currentChat,
      title: currentChat.messages.length ? currentChat.title : safeTitle(prompt).slice(0, 54),
      mode,
      messages: [...currentChat.messages, userMessage],
      updatedAt: now,
    };
    const withUser = {
      ...store,
      chats: [optimistic, ...store.chats.filter((item) => item.id !== optimistic.id)],
    };
    commitStore(withUser);
    setActiveChatId(optimistic.id);

    try {
      const [token, contextEntries] = await Promise.all([getToken(), scopeContext(scope, prompt)]);
      const response = await fetch("/api/agent-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          question: prompt,
          mode,
          scope,
          projectTitle: activeProject.title,
          chatTitle: optimistic.title,
          contextEntries,
          thinkingEnabled,
          modelProvider,
          model: modelProvider === "openrouter" ? selectedOpenRouterModel : undefined,
          stream: true,
          history: optimistic.messages.slice(-6).map((message) => ({ role: message.role, content: message.content })),
        }),
      });
      const responseContentType = String(response.headers.get("content-type") || "").toLowerCase();
      if (responseContentType.includes("text/html")) {
        throw new Error("AskAI 当前连接到了前端页面而非服务函数。本地请配置函数模拟器；线上请检查 EdgeOne Functions 路由。");
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || "研究服务暂时不可用");
      }
      if (!response.body || !responseContentType.includes("text/event-stream")) {
        const payload = await response.json() as { answer?: string; sources?: ResearchMessage["sources"]; usage?: ResearchMessage["usage"]; error?: string };
        if (!payload.answer) throw new Error(payload.error || "研究服务暂时不可用");
        const assistantMessage: ResearchMessage = { id: uid("message"), role: "assistant", content: payload.answer, sources: payload.sources || [], usage: payload.usage, createdAt: new Date().toISOString() };
        const completed = { ...optimistic, messages: [...optimistic.messages, assistantMessage], updatedAt: assistantMessage.createdAt };
        commitStore({ ...withUser, chats: [completed, ...withUser.chats.filter((item) => item.id !== completed.id)] });
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let sources: ResearchMessage["sources"] = [];
      let usage: ResearchMessage["usage"] | undefined;
      const assistantId = uid("message");
      const publishPartial = () => {
        const partialMessage: ResearchMessage = { id: assistantId, role: "assistant", content: answer, sources, usage, createdAt: new Date().toISOString() };
        const partial = { ...optimistic, messages: [...optimistic.messages, partialMessage], updatedAt: partialMessage.createdAt };
        // Keep token-by-token rendering local. Persist only the completed
        // answer remotely so a long response cannot create version conflicts
        // or overwrite itself across devices.
        commitLocalStore({ ...withUser, chats: [partial, ...withUser.chats.filter((item) => item.id !== partial.id)] });
      };
      for (;;) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replace(/\r\n/g, "\n");
        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";
        for (const frame of frames) {
          const event = frame.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
          const raw = frame.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
          if (!event || !raw) continue;
          let payload: { delta?: string; sources?: ResearchMessage["sources"]; usage?: ResearchMessage["usage"]; stage?: StreamStage; error?: string; requestId?: string };
          try {
            payload = JSON.parse(raw) as typeof payload;
          } catch {
            // A proxy keep-alive must not turn an otherwise live SSE response
            // into a failed research request.
            continue;
          }
          if (event === "status" && payload.stage) setStreamStage(payload.stage);
          if (event === "meta") sources = payload.sources || [];
          if (event === "delta" && payload.delta) { answer += payload.delta; publishPartial(); }
          if (event === "done") { sources = payload.sources || sources; usage = payload.usage; }
          if (event === "error") throw new Error(`${payload.error || "研究服务暂时不可用"}${payload.requestId ? `（请求 ${payload.requestId.slice(0, 8)}）` : ""}`);
        }
        if (done) break;
      }
      if (!answer) throw new Error("模型没有返回可用答案");
      const assistantMessage: ResearchMessage = {
        id: assistantId,
        role: "assistant",
        content: answer,
        sources,
        usage,
        createdAt: new Date().toISOString(),
      };
      const completed = {
        ...optimistic,
        messages: [...optimistic.messages, assistantMessage],
        updatedAt: assistantMessage.createdAt,
      };
      commitStore({
        ...withUser,
        chats: [completed, ...withUser.chats.filter((item) => item.id !== completed.id)],
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "研究服务暂时不可用");
    } finally {
      setThinkingSince(null);
      setStreamStage("preparing");
    }
  };

  const answerFavoriteId = (message: ResearchMessage) => activeChat ? `askai-answer:${activeChat.id}:${message.id}` : "";
  const chatFavoriteId = () => activeChat ? `askai-chat:${activeChat.id}` : "";
  const isFavorite = (id: string) => favorites.some((item) => item.id === id);

  const toggleAnswerFavorite = (message: ResearchMessage, index: number) => {
    if (!activeProject || !activeChat) return;
    const questionMessage = [...activeChat.messages.slice(0, index)].reverse().find((item) => item.role === "user");
    const title = questionMessage?.content || activeChat.title;
    const markdown = markdownForAnswer(message, title, activeProject.title, activeChat.title, scope);
    const id = answerFavoriteId(message);
    if (isFavorite(id)) {
      const existing = favorites.find((item) => item.id === id);
      removePersonalKnowledge(id);
      if (existing) queueRemoteFavorite("unfavorite", existing);
      setNotice("已取消收藏回答");
    } else {
      const favorite: PersonalKnowledgeNote = {
        id,
        title: safeTitle(title),
        body: markdown,
        scope,
        projectTitle: activeProject.title,
        chatTitle: activeChat.title,
        sourceCount: message.sources?.length || 0,
        createdAt: new Date().toISOString(),
        kind: "answer",
        sourceChatId: activeChat.id,
        sourceMessageId: message.id,
      };
      savePersonalKnowledge(favorite);
      queueRemoteFavorite("favorite-answer", favorite);
      setNotice("已收藏回答，并加入个人知识库");
    }
  };

  const toggleChatFavorite = () => {
    if (!activeProject || !activeChat) return;
    const id = chatFavoriteId();
    if (isFavorite(id)) {
      const existing = favorites.find((item) => item.id === id);
      removePersonalKnowledge(id);
      if (existing) queueRemoteFavorite("unfavorite", existing);
      setNotice("已取消收藏 Chat");
      return;
    }
    const favorite: PersonalKnowledgeNote = {
      id,
      title: safeTitle(activeChat.title),
      body: markdownForChat(activeChat, activeProject),
      scope,
      projectTitle: activeProject.title,
      chatTitle: activeChat.title,
      sourceCount: activeChat.messages.reduce((total, message) => total + (message.sources?.length || 0), 0),
      createdAt: new Date().toISOString(),
      kind: "chat",
      sourceChatId: activeChat.id,
    };
    savePersonalKnowledge(favorite);
    queueRemoteFavorite("favorite-chat", favorite);
    setNotice("已收藏整个 Chat，并加入个人知识库");
  };

  const downloadChatHistory = () => {
    if (!activeProject || !activeChat) return;
    downloadMarkdown(markdownForChat(activeChat, activeProject), activeChat.title);
    setNotice("已下载完整 Chat history");
  };

  const exportChatToObsidian = async () => {
    if (!activeProject || !activeChat) return;
    await sendMarkdownToObsidian(markdownForChat(activeChat, activeProject), activeChat.title);
    setNotice("已导出完整 Chat history 到 Obsidian");
  };

  return (
    <section className="agentic-layer">
      <div className="agentic-layout">
        <aside className="agentic-sidebar">
          <div className="agentic-list-head"><strong>Projects</strong><button onClick={newProject}>＋</button></div>
          <div className="agentic-list">
            {projects.map((project) => (
              <div key={project.id} className={project.id === activeProject?.id ? "agentic-row active" : "agentic-row"}>
                <button className="agentic-row-main" onClick={() => { setActiveProjectId(project.id); setActiveChatId(""); }}><strong>{project.title}</strong></button>
                <button title="重命名" onClick={() => renameProject(project)}>✎</button>
                <button title="删除" onClick={() => deleteProject(project)}>×</button>
              </div>
            ))}
          </div>
          <div className="agentic-list-head"><strong>Chats</strong><button onClick={newChat}>＋</button></div>
          <div className="agentic-list">
            {chats.length === 0 && <p className="agentic-empty-list">还没有聊天</p>}
            {chats.map((chat) => (
              <div key={chat.id} className={chat.id === activeChat?.id ? "agentic-row active" : "agentic-row"}>
                <button className="agentic-row-main" onClick={() => { setActiveChatId(chat.id); setMode(chat.mode); }}><strong>{chat.title}</strong><small>{chat.messages.length} 条</small></button>
                <button title="重命名" onClick={() => renameChat(chat)}>✎</button>
                <button title="删除" onClick={() => deleteChat(chat)}>×</button>
              </div>
            ))}
          </div>
        </aside>

        <div className="agentic-chat">
          {activeChat && (
            <div className="agentic-chat-actions" aria-label="Chat actions">
              <strong>{activeChat.title}</strong>
              <div>
                <button type="button" onClick={toggleChatFavorite}>{isFavorite(chatFavoriteId()) ? "取消收藏 Chat" : "收藏 Chat"}</button>
                <button type="button" onClick={downloadChatHistory} disabled={!activeChat.messages.length}>下载整个 Chat history .md</button>
                <button type="button" onClick={() => void exportChatToObsidian()} disabled={!activeChat.messages.length}>导出整个 Chat history 到 Obsidian</button>
              </div>
            </div>
          )}
          <div className="agentic-messages" ref={scrollRef}>
            {!activeChat?.messages.length && <div className="agentic-chat-empty">输入问题后，系统会在 Notes、Ideas、事件库与 AI Capex 间跨库检索，再按所选模式验证公开网络。</div>}
            {activeChat?.messages.map((message, index) => (
              <article key={message.id} className={`agentic-message ${message.role}`}>
                <span>{message.role === "user" ? "You" : "AI"}</span>
                <div>
                  {message.role === "assistant"
                    ? <MarkdownAnswer value={message.content} />
                    : <p>{message.content}</p>}
                  {!!message.sources?.length && (
                    <div className="agentic-sources">
                      {message.sources.map((source) => <a key={`${source.index}-${source.url}`} href={source.url} target="_blank" rel="noreferrer">[{source.index}] {source.title}</a>)}
                    </div>
                  )}
                  {message.role === "assistant" && (
                    <footer>
                      <button onClick={() => toggleAnswerFavorite(message, index)}>{isFavorite(answerFavoriteId(message)) ? "取消收藏" : "收藏"}</button>
                      {message.usage && <small>{message.usage.provider} · {message.usage.model} · {message.usage.thinkingEnabled === false ? "Thinking 关闭" : "Thinking 开启"} · {(message.usage.inputTokens + message.usage.outputTokens).toLocaleString()} tokens{typeof message.usage.estimatedCostUsd === "number" ? ` · $${message.usage.estimatedCostUsd.toFixed(4)}` : ""}{typeof message.usage.latencyMs === "number" ? ` · ${(message.usage.latencyMs / 1000).toFixed(1)}s` : ""}{message.usage.webCredits ? ` · Tavily ${message.usage.webCredits} credits` : ""}</small>}
                    </footer>
                  )}
                </div>
              </article>
            ))}
            {thinkingSince && <article className="agentic-message assistant"><span>AI</span><div className="agentic-thinking"><i />{{
              preparing: "正在准备研究任务",
              authenticated: "身份验证完成",
              retrieving_context: "正在查询团队知识库",
              context_ready: "知识库证据已整理",
              retrieving_web: "正在联网验证",
              web_ready: "公开来源已返回",
              connecting_provider: "正在连接所选模型",
              provider_connected: "模型已连接，等待首个回答片段",
              provider_streaming: "模型已开始响应",
              first_token: "正在生成回答",
              complete: "分析完成",
              error: "分析中断",
            }[streamStage]} · {thinkingSeconds}s</div></article>}
          </div>
          <form className="agentic-composer" onSubmit={ask}>
            <div className="agentic-modes">
              <button type="button" className={mode === "context" ? "active" : ""} onClick={() => setMode("context")}>跨库</button>
              <button type="button" className={mode === "hybrid" ? "active" : ""} onClick={() => setMode("hybrid")}>联网</button>
              <label className="agentic-model-picker"><span>模型</span><select value={modelProvider === "openrouter" ? selectedOpenRouterModel : "__default"} onChange={(event) => {
                if (event.target.value === "__default") { setModelProvider("default"); setError(""); }
                else {
                  const nextModel = event.target.value;
                  setModelProvider("openrouter"); setSelectedOpenRouterModel(nextModel); setError("");
                  if (!openRouterModels.find((item) => item.model === nextModel)?.thinkingSupported) selectThinking(false);
                }
              }}><option value="__default">DeepSeek · {defaultModel}</option>{openRouterModels.length > 0 && <optgroup label="OpenRouter · 已配置">{openRouterModels.map((item) => <option key={item.model} value={item.model}>OpenRouter · {item.model}</option>)}</optgroup>}<optgroup label="OpenRouter · 待配置预览">{openRouterPreviewModels.filter((item) => !openRouterModels.some((configured) => configured.model === item.model)).map((item) => <option key={item.model} value={item.model}>OpenRouter · {item.label}（待配置）</option>)}</optgroup></select></label>
              {openRouterUnavailable && <small className="agentic-model-status">OpenRouter 待配置 · 不会发送请求</small>}
              <span className="agentic-mode-spacer" />
              <button type="button" disabled={!thinkingAvailable} className={thinkingEnabled && thinkingAvailable ? "active" : ""} onClick={() => selectThinking(true)}>Thinking 开</button>
              <button type="button" className={!thinkingEnabled ? "active" : ""} onClick={() => selectThinking(false)}>Thinking 关</button>
            </div>
            <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={scope === "notes" ? "例如：这些 Notes 中有哪些判断可由事件或 AI Capex 数据验证？" : scope === "ideas" ? "例如：哪些 Notes、事件或 AI Capex 数据支持或反驳这些 Ideas？" : "例如：跨 Notes、Ideas、事件库与 AI Capex，哪些证据能够互相验证？"} />
            <button type="submit" disabled={!question.trim() || !!thinkingSince || openRouterUnavailable}>{thinkingSince ? "分析中" : openRouterUnavailable ? "待配置" : "发送"}</button>
          </form>
          {(error || notice) && <p className={error ? "agentic-status error" : "agentic-status"}>{error || notice}</p>}
        </div>
      </div>
    </section>
  );
}

export function PersonalKnowledgeView() {
  const { getToken } = useAuth();
  const [notes, setNotes] = useState<PersonalKnowledgeNote[]>(() => loadPersonalKnowledge());
  const [selectedId, setSelectedId] = useState("");
  const [syncState, setSyncState] = useState<"loading" | "account" | "local">("loading");
  const remoteVersion = useRef(0);

  useEffect(() => {
    const refresh = () => setNotes(loadPersonalKnowledge());
    window.addEventListener("level-grind:knowledge-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("level-grind:knowledge-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("AUTH_MISSING");
        const response = await fetch("/api/askai-history?view=knowledge", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const payload = await response.json().catch(() => ({})) as HistoryResponse;
        if (!response.ok) throw new Error(payload.error || "KNOWLEDGE_UNAVAILABLE");
        if (cancelled) return;
        remoteVersion.current = payload.version;
        const entries = payload.entries || [];
        persistPersonalKnowledge(entries);
        setNotes(entries);
        setSyncState("account");
      } catch {
        if (!cancelled) setSyncState("local");
      }
    })();
    return () => { cancelled = true; };
  }, [getToken]);

  const selected = notes.find((note) => note.id === selectedId) || notes[0];
  const remove = async (note: PersonalKnowledgeNote) => {
    if (!window.confirm(`删除“${note.title}”？`)) return;
    removePersonalKnowledge(note.id);
    setSelectedId("");
    if (syncState !== "account") return;
    try {
      const token = await getToken();
      if (!token) throw new Error("AUTH_MISSING");
      const response = await fetch("/api/askai-history", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "unfavorite", kind: note.kind === "chat" ? "chat" : "answer", id: note.id, expectedVersion: remoteVersion.current }),
      });
      const payload = await response.json().catch(() => ({})) as HistoryResponse;
      if (!response.ok) throw new Error(payload.error || "KNOWLEDGE_DELETE_FAILED");
      remoteVersion.current = payload.version;
      const entries = favoriteEntries(payload.favorites);
      persistPersonalKnowledge(entries);
      setNotes(entries);
    } catch {
      setSyncState("local");
    }
  };

  return (
    <section className="personal-knowledge-live">
      <header><p className="eyebrow">PERSONAL KNOWLEDGE</p><h2>已收藏的研究结果</h2><span>{notes.length} 条 · {syncState === "account" ? "账户同步" : syncState === "loading" ? "正在同步" : "当前设备"}</span></header>
      {notes.length === 0 ? (
        <div className="personal-knowledge-empty">收藏一条 AskAI 回答或整个 Chat，它会显示在这里。</div>
      ) : (
        <div className="personal-knowledge-grid">
          <div className="personal-knowledge-list">
            {notes.map((note) => (
              <button key={note.id} className={note.id === selected?.id ? "active" : ""} onClick={() => setSelectedId(note.id)}>
                <strong>{note.title}</strong><small>{note.kind === "chat" ? "Chat 收藏" : "回答收藏"} · {note.projectTitle} · {new Date(note.createdAt).toLocaleString("zh-CN")}</small>
              </button>
            ))}
          </div>
          {selected && (
            <article className="personal-knowledge-detail">
              <header><div><span>{scopeLabels[selected.scope]}</span><h3>{selected.title}</h3></div><button onClick={() => void remove(selected)}>删除</button></header>
              <pre>{selected.body}</pre>
              <footer>
                <button onClick={() => downloadMarkdown(selected.body, selected.title)}>下载 .md</button>
                <button onClick={() => void sendMarkdownToObsidian(selected.body, selected.title)}>导出 Obsidian</button>
              </footer>
            </article>
          )}
        </div>
      )}
    </section>
  );
}
