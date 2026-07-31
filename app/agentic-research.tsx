"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { MarkdownAnswer } from "./markdown-answer";

export type ResearchScope = "events" | "aidc";
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
};
type AgentStore = {
  projects: ResearchProject[];
  chats: ResearchChat[];
};
type ContextEntry = {
  id: string;
  title: string;
  content: string;
};

const storeKey = "level-grind.agentic-research.v1";
const knowledgeKey = "level-grind.personal-knowledge.v1";
const vaultKey = "lg-obsidian-vault";
const thinkingKey = "level-grind.askai-thinking.v1";

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
    `source: Level Grind ${scope === "events" ? "Event DB" : "AI Capex"}`,
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

function savePersonalKnowledge(note: PersonalKnowledgeNote) {
  const notes = loadPersonalKnowledge();
  const next = [note, ...notes.filter((item) => item.id !== note.id)];
  writeJson(knowledgeKey, next);
  window.dispatchEvent(new CustomEvent("level-grind:knowledge-updated"));
}

function defaultProject(scope: ResearchScope): ResearchProject {
  const now = new Date().toISOString();
  return {
    id: uid(`project-${scope}`),
    scope,
    title: scope === "events" ? "事件与价格研究" : "AI Capex 研究",
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
  const primary = scope === "events" ? events : aidc;
  const secondary = scope === "events" ? aidc : events;
  return [...primary.slice(0, 6), ...secondary.slice(0, 6)];
}

export function AgenticResearchPanel({ scope }: { scope: ResearchScope }) {
  const { getToken } = useAuth();
  const [store, setStore] = useState<AgentStore>(() => {
    const current = readJson<AgentStore>(storeKey, { projects: [], chats: [] });
    const missingScopes = (["events", "aidc"] as ResearchScope[])
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
  const [mode, setMode] = useState<EvidenceMode>("hybrid");
  const [thinkingEnabled, setThinkingEnabled] = useState(() =>
    readJson<boolean>(thinkingKey, true)
  );
  const [thinkingSince, setThinkingSince] = useState<number | null>(null);
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const projects = useMemo(
    () => store.projects.filter((project) => project.scope === scope),
    [scope, store.projects],
  );
  const chats = useMemo(
    () => store.chats.filter((chat) => chat.scope === scope && chat.projectId === activeProjectId),
    [activeProjectId, scope, store.chats],
  );
  const activeProject = projects.find((project) => project.id === activeProjectId) || projects[0];
  const activeChat = chats.find((chat) => chat.id === activeChatId) || chats[0];

  useEffect(() => {
    if (!thinkingSince) return;
    const update = () => setThinkingSeconds(Math.floor((Date.now() - thinkingSince) / 1000));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [thinkingSince]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeChat?.messages.length, thinkingSince]);

  const commitStore = (next: AgentStore) => {
    setStore(next);
    writeJson(storeKey, next);
  };

  const selectThinking = (enabled: boolean) => {
    setThinkingEnabled(enabled);
    writeJson(thinkingKey, enabled);
  };

  const newProject = () => {
    const title = safeTitle(window.prompt("项目名称", scope === "events" ? "新的事件研究" : "新的 AI Capex 研究") || "");
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
    setQuestion("");
    setError("");
    setNotice("");
    setThinkingSince(Date.now());
    setThinkingSeconds(0);
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
          history: optimistic.messages.slice(-6).map((message) => ({ role: message.role, content: message.content })),
        }),
      });
      const payload = await response.json() as {
        answer?: string;
        sources?: ResearchMessage["sources"];
        usage?: ResearchMessage["usage"];
        error?: string;
      };
      if (!response.ok || !payload.answer) throw new Error(payload.error || "研究服务暂时不可用");
      const assistantMessage: ResearchMessage = {
        id: uid("message"),
        role: "assistant",
        content: payload.answer,
        sources: payload.sources || [],
        usage: payload.usage,
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
    }
  };

  const actOnAnswer = async (action: "save" | "download" | "obsidian", message: ResearchMessage, index: number) => {
    if (!activeProject || !activeChat) return;
    const questionMessage = [...activeChat.messages.slice(0, index)].reverse().find((item) => item.role === "user");
    const title = questionMessage?.content || activeChat.title;
    const markdown = markdownForAnswer(message, title, activeProject.title, activeChat.title, scope);
    if (action === "save") {
      savePersonalKnowledge({
        id: uid("knowledge"),
        title: safeTitle(title),
        body: markdown,
        scope,
        projectTitle: activeProject.title,
        chatTitle: activeChat.title,
        sourceCount: message.sources?.length || 0,
        createdAt: new Date().toISOString(),
      });
      setNotice("已保存到个人知识库");
    } else if (action === "download") {
      downloadMarkdown(markdown, title);
      setNotice("Markdown 已下载");
    } else {
      await sendMarkdownToObsidian(markdown, title);
      setNotice("已发送到 Obsidian");
    }
  };

  return (
    <section className="agentic-layer">
      <header className="agentic-head">
        <div><p className="eyebrow">AGENTIC RESEARCH</p><h2>{scope === "events" ? "询问事件与价格" : "询问 AI Capex"}</h2></div>
        <div className="agentic-engine">
          <strong>DeepSeek V4 Flash</strong>
          <small>{thinkingEnabled ? "Thinking 开启" : "Thinking 关闭"} · Tavily</small>
        </div>
      </header>
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
          <div className="agentic-messages" ref={scrollRef}>
            {!activeChat?.messages.length && <div className="agentic-chat-empty">输入问题后，系统会联动事件库与 AI Capex，再按所选模式检索公开网络。</div>}
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
                      <button onClick={() => void actOnAnswer("save", message, index)}>保存</button>
                      <button onClick={() => void actOnAnswer("download", message, index)}>下载 .md</button>
                      <button onClick={() => void actOnAnswer("obsidian", message, index)}>导出 Obsidian</button>
                      {message.usage && <small>{message.usage.model} · {message.usage.thinkingEnabled === false ? "Thinking 关闭" : "Thinking 开启"} · {(message.usage.inputTokens + message.usage.outputTokens).toLocaleString()} tokens · Tavily {message.usage.webCredits} credits</small>}
                    </footer>
                  )}
                </div>
              </article>
            ))}
            {thinkingSince && <article className="agentic-message assistant"><span>AI</span><div className="agentic-thinking"><i />正在检索与分析 · {thinkingSeconds}s</div></article>}
          </div>
          <form className="agentic-composer" onSubmit={ask}>
            <div className="agentic-modes">
              <button type="button" className={mode === "hybrid" ? "active" : ""} onClick={() => setMode("hybrid")}>混合</button>
              <button type="button" className={mode === "context" ? "active" : ""} onClick={() => setMode("context")}>内部数据</button>
              <button type="button" className={mode === "web" ? "active" : ""} onClick={() => setMode("web")}>联网</button>
              <span className="agentic-mode-spacer" />
              <button type="button" className={thinkingEnabled ? "active" : ""} onClick={() => selectThinking(true)}>Thinking 开</button>
              <button type="button" className={!thinkingEnabled ? "active" : ""} onClick={() => selectThinking(false)}>Thinking 关</button>
            </div>
            <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={scope === "events" ? "例如：哪些事件可以用 AI Capex 的园区和容量数据交叉验证？" : "例如：哪些事件库 Claim 能由 AI Capex 数据支持或反驳？"} />
            <button type="submit" disabled={!question.trim() || !!thinkingSince}>{thinkingSince ? "分析中" : "发送"}</button>
          </form>
          {(error || notice) && <p className={error ? "agentic-status error" : "agentic-status"}>{error || notice}</p>}
        </div>
      </div>
    </section>
  );
}

export function PersonalKnowledgeView() {
  const [notes, setNotes] = useState<PersonalKnowledgeNote[]>(() => loadPersonalKnowledge());
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    const refresh = () => setNotes(loadPersonalKnowledge());
    window.addEventListener("level-grind:knowledge-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("level-grind:knowledge-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const selected = notes.find((note) => note.id === selectedId) || notes[0];
  const remove = (note: PersonalKnowledgeNote) => {
    if (!window.confirm(`删除“${note.title}”？`)) return;
    const next = notes.filter((item) => item.id !== note.id);
    writeJson(knowledgeKey, next);
    setNotes(next);
    setSelectedId("");
  };

  return (
    <section className="personal-knowledge-live">
      <header><p className="eyebrow">PERSONAL KNOWLEDGE</p><h2>已保存的研究结果</h2><span>{notes.length} 条 · 当前设备</span></header>
      {notes.length === 0 ? (
        <div className="personal-knowledge-empty">在事件库或 AI Capex 的回答下点击“保存”，结果会显示在这里。</div>
      ) : (
        <div className="personal-knowledge-grid">
          <div className="personal-knowledge-list">
            {notes.map((note) => (
              <button key={note.id} className={note.id === selected?.id ? "active" : ""} onClick={() => setSelectedId(note.id)}>
                <strong>{note.title}</strong><small>{note.projectTitle} · {new Date(note.createdAt).toLocaleString("zh-CN")}</small>
              </button>
            ))}
          </div>
          {selected && (
            <article className="personal-knowledge-detail">
              <header><div><span>{selected.scope === "events" ? "事件库" : "AI Capex"}</span><h3>{selected.title}</h3></div><button onClick={() => remove(selected)}>删除</button></header>
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
