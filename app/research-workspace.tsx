"use client";

import { useAuth } from "@clerk/react";
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

type View = "inbox" | "library" | "assistant" | "history" | "settings";
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
  citations: Array<ReportCitation | WebCitation>;
  webResults: WebResult[];
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
  assistant: "✦",
  history: "↺",
  settings: "⚙",
};

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
    return `${citation.index}. ${citation.company} · ${citation.title} · p.${citation.page}`;
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

export function ResearchWorkspace() {
  const { getToken, sessionId } = useAuth();
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
  const [preferences, setPreferences] = useState<PreferencesPayload | null>(null);
  const [history, setHistory] = useState<AskResult[]>([]);
  const [askResult, setAskResult] = useState<AskResult | null>(null);
  const [selected, setSelected] = useState<DocumentRecord | null>(null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<EvidenceMode>("reports");
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
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
    if (typeof window === "undefined") return "Research";
    return window.localStorage.getItem("lg-obsidian-vault") || "Research";
  });
  const fileRef = useRef<HTMLInputElement>(null);

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
    try {
      const responses = await Promise.all([
        authorizedFetch("/api/documents?scope=team"),
        authorizedFetch("/api/context"),
        authorizedFetch("/api/members"),
        authorizedFetch("/api/corpus"),
        authorizedFetch("/api/preferences"),
        authorizedFetch("/api/ask"),
      ]);
      if (responses.some((response) => !response.ok)) {
        throw new Error("The research workspace could not be loaded.");
      }
      const [documentsData, contextData, membersData, corpusData, preferenceData, historyData] =
        await Promise.all(responses.map((response) => response.json())) as [
          { documents: DocumentRecord[] },
          ContextPayload,
          { members: TeamMember[] },
          CorpusPayload,
          PreferencesPayload,
          { history: AskResult[] },
        ];
      setDocuments(documentsData.documents ?? []);
      setContext(contextData);
      setMembers(membersData.members ?? []);
      setCorpus(corpusData);
      setPreferences(preferenceData);
      setHistory(historyData.history ?? []);
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

  const filteredDocuments = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return documents;
    return documents.filter((doc) =>
      [doc.title, doc.body, doc.project, doc.topics, doc.author_name]
        .some((value) => String(value || "").toLowerCase().includes(term)),
    );
  }, [documents, query]);

  const filteredCorpus = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return corpus?.documents ?? [];
    return (corpus?.documents ?? []).filter((doc) =>
      [doc.company_name, doc.security_code, doc.title, doc.document_type]
        .some((value) => value.toLowerCase().includes(term)),
    );
  }, [corpus?.documents, query]);

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
    const form = new FormData(event.currentTarget);
    const question = String(form.get("question") ?? "").trim();
    if (!question) return;
    setAsking(true);
    setError("");
    setAskResult(null);
    try {
      const response = await authorizedFetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, mode }),
      });
      const payload = await response.json() as AskResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "The research assistant could not answer.");
      setAskResult(payload);
      setHistory((current) => payload.id ? [payload, ...current.filter((item) => item.id !== payload.id)] : current);
      const corpusResponse = await authorizedFetch("/api/corpus");
      if (corpusResponse.ok) setCorpus(await corpusResponse.json() as CorpusPayload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The research assistant could not answer.");
    } finally {
      setAsking(false);
    }
  }

  function openReport(document: CorpusDocument) {
    setOpeningReportId(document.id);
    const popup = window.open(`/api/corpus/files/${document.id}`, "_blank", "noopener,noreferrer");
    if (!popup) {
      setError(language === "zh" ? "浏览器阻止了新窗口，请允许弹窗后重试。" : "The browser blocked the report tab. Allow pop-ups and try again.");
    }
    window.setTimeout(() => setOpeningReportId(""), 1800);
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
    window.location.href = `obsidian://new?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(file)}&clipboard=true`;
    setToast(language === "zh" ? "已复制并发送至 Obsidian" : "Copied and sent to Obsidian");
  }

  function saveVault() {
    window.localStorage.setItem("lg-obsidian-vault", vaultName.trim() || "Research");
    setToast(language === "zh" ? "Vault 名称已保存在本设备" : "Vault name saved on this device");
  }

  const heading = c.heading[active];
  const storagePercent = preferences
    ? Math.min(100, (preferences.storage.usedBytes / Math.max(1, preferences.storage.quotaBytes)) * 100)
    : 0;
  const isAdmin = context?.user.role === "owner" || context?.user.role === "admin";

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
              {id === "history" && history.length > 0 && <em>{history.length}</em>}
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
          <div className="search">
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={c.search} />
            <kbd>⌘ K</kbd>
          </div>
          <div className="language-switch" aria-label="Language">
            <button className={language === "en" ? "active" : ""} onClick={() => void switchLanguage("en")}>EN</button>
            <button className={language === "zh" ? "active" : ""} onClick={() => void switchLanguage("zh")}>中</button>
          </div>
          {active !== "assistant" && active !== "history" && (
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
                      <button className="quiet-button report-open" disabled={openingReportId === document.id} onClick={() => openReport(document)}>
                        {openingReportId === document.id && <i className="button-spinner" />}
                        {openingReportId === document.id ? c.opening : c.openReport}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {active === "assistant" && (
            <section className="assistant-board">
              <div className="usage-strip">
                <article><span>{c.yourQueries}</span><strong>{corpus?.usage.query_count || 0}</strong></article>
                <article><span>{c.inputTokens}</span><strong>{Number(corpus?.usage.input_tokens || 0).toLocaleString()}</strong></article>
                <article><span>{c.outputTokens}</span><strong>{Number(corpus?.usage.output_tokens || 0).toLocaleString()}</strong></article>
                <article><span>{c.estCost}</span><strong>${Number(corpus?.usage.estimated_cost_usd || 0).toFixed(4)}</strong></article>
              </div>
              <form className="ask-box ask-box-v2" onSubmit={askResearch}>
                <div className="ask-title-row"><div><p className="eyebrow">DEEP RESEARCH</p><h2>{c.askTitle}</h2></div><span>DeepSeek · v4-flash</span></div>
                <fieldset className="mode-picker">
                  <legend>{c.evidenceMode}</legend>
                  {([
                    ["reports", c.modeReports, c.modeReportsNote],
                    ["web", c.modeWeb, c.modeWebNote],
                    ["hybrid", c.modeHybrid, c.modeHybridNote],
                  ] as Array<[EvidenceMode, string, string]>).map(([id, label, note]) => (
                    <button type="button" key={id} className={mode === id ? "active" : ""} onClick={() => setMode(id)}>
                      <span>{id === "reports" ? "▤" : id === "web" ? "◎" : "◈"}</span>
                      <strong>{label}</strong><small>{note}</small>
                    </button>
                  ))}
                </fieldset>
                <textarea name="question" required rows={4} placeholder={c.askPlaceholder} />
                <div className="composer-foot">
                  <span>{mode === "reports" ? c.evidenceReports : mode === "web" ? c.evidenceWeb : c.evidenceHybrid}</span>
                  <button className="upload-button" disabled={asking || (mode === "reports" && !corpus?.documents.length)}>
                    {asking && <i className="button-spinner light" />}{asking ? c.researching : c.ask}
                  </button>
                </div>
              </form>
              {askResult && (
                <AnswerCard
                  result={askResult}
                  language={language}
                  corpus={corpus?.documents ?? []}
                  savedWebUrls={savedWebUrls}
                  saving={saving}
                  openReport={openReport}
                  saveWebResult={saveWebResult}
                  onExport={() => downloadText(answerMarkdown(askResult), askResult.question || "Level Grind research")}
                  onObsidian={() => void sendToObsidian(answerMarkdown(askResult), askResult.question || "Level Grind research")}
                  isAdmin={Boolean(isAdmin)}
                />
              )}
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

          {active === "history" && (
            <section className="history-layout">
              <div className="history-list">
                <div className="section-title"><h2>{c.nav.history}</h2><span>{history.length}</span></div>
                {!history.length ? (
                  <div className="empty-state"><h3>{c.historyEmpty}</h3><p>{c.historyEmptyBody}</p></div>
                ) : history.map((item) => (
                  <button key={item.id || item.createdAt} className={askResult?.id === item.id ? "history-row active" : "history-row"} onClick={() => setAskResult(item)}>
                    <span className={`mode-dot mode-${item.mode || "reports"}`} />
                    <strong>{item.question}</strong>
                    <small>{item.createdAt ? new Date(item.createdAt).toLocaleString(language === "zh" ? "zh-CN" : "en") : ""}</small>
                    <em>{item.mode === "web" ? c.modeWeb : item.mode === "hybrid" ? c.modeHybrid : c.modeReports}</em>
                  </button>
                ))}
              </div>
              <div className="history-detail">
                {askResult ? (
                  <AnswerCard
                    result={askResult}
                    language={language}
                    corpus={corpus?.documents ?? []}
                    savedWebUrls={savedWebUrls}
                    saving={saving}
                    openReport={openReport}
                    saveWebResult={saveWebResult}
                    onExport={() => downloadText(answerMarkdown(askResult), askResult.question || "Level Grind research")}
                    onObsidian={() => void sendToObsidian(answerMarkdown(askResult), askResult.question || "Level Grind research")}
                    isAdmin={Boolean(isAdmin)}
                    compact
                  />
                ) : <div className="detail-placeholder">{c.selectItem}</div>}
              </div>
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
                <label>{c.vaultName}<input value={vaultName} onChange={(event) => setVaultName(event.target.value)} /></label>
                <button className="quiet-button" onClick={saveVault}>{c.saveLocal}</button>
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
  openCapture,
}: {
  language: Language;
  loading: boolean;
  documents: DocumentRecord[];
  selected: DocumentRecord | null;
  setSelected: (doc: DocumentRecord) => void;
  onExport: (doc: DocumentRecord) => void;
  onObsidian: (doc: DocumentRecord) => void;
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
            <div className="detail-actions"><button onClick={() => onExport(selected)}>↓ {c.downloadMarkdown}</button><button className="obsidian-button" onClick={() => onObsidian(selected)}>{c.openObsidian} ↗</button></div>
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
        {result.citations.map((citation) => citation.kind === "report" ? (
          <button key={`report-${citation.index}`} onClick={() => {
            const document = corpus.find((item) => item.id === citation.documentId);
            if (document) openReport(document);
          }}>
            <span>[{citation.index}]</span><strong>{citation.company} · {citation.title}</strong><small>p.{citation.page}</small>
          </button>
        ) : (
          <a key={`web-${citation.index}`} href={citation.url} target="_blank" rel="noreferrer">
            <span>[{citation.index}]</span><strong>{citation.title}</strong><small>{new URL(citation.url).hostname} ↗</small>
          </a>
        ))}
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
