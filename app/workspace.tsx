"use client";

import { useAuth } from "@clerk/react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type View = "inbox" | "library" | "assistant" | "personal" | "team" | "tasks" | "routing" | "sources";

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

type ContextTask = {
  id: string;
  title: string;
  objective: string;
  topic: string;
  status: string;
  context_scope: string;
  output_format: string;
  guardrails: string;
  updated_at: string;
};

type ContextPayload = {
  user: { email: string; name: string; role: "owner" | "admin" | "member" };
  personal: PersonalContext;
  tasks: ContextTask[];
  topics: Array<{ topic: string; item_count: number; last_signal: string }>;
  sources: Array<{ source: string; item_count: number }>;
  counts: { personal_items: number; team_items: number; high_signals: number };
};

type TeamMember = {
  email: string;
  display_name: string;
  role: "owner" | "admin" | "member";
  status: "active" | "suspended";
  updated_at: string;
};

type RoutingPolicy = {
  email: string;
  reminder_enabled: number;
  trigger_rules: string;
};

type ConversationWorkstream = {
  id: string;
  project_name: string;
  chat_title: string;
  active_goal: string;
  deliverable: string;
  shift_reason: string;
  recommended_action: "continue" | "new-chat" | "new-project";
  handoff_summary: string;
  status: string;
  updated_at: string;
};

type RoutingPayload = {
  policy: RoutingPolicy;
  workstreams: ConversationWorkstream[];
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

type AskResult = {
  answer: string;
  usage?: { inputTokens: number; outputTokens: number; estimatedCostUsd: number; model: string; provider: string };
  citations: Array<{ index: number; documentId: string; company: string; title: string; page: number }>;
};

const navItems: Array<[View, string, string]> = [
  ["inbox", "Research inbox", "⌂"],
  ["library", "Report library", "▤"],
  ["assistant", "Ask reports", "✦"],
  ["personal", "My context", "◌"],
  ["team", "Team context", "◎"],
  ["tasks", "Task context", "◇"],
  ["routing", "Conversation routing", "↗"],
  ["sources", "System boundary", "⊙"],
];

const routingLabels = {
  continue: "Continue current chat",
  "new-chat": "Start a new chat",
  "new-project": "Start a new project",
} as const;

const sourceBoundaries = [
  {
    name: "Web capture",
    state: "Active",
    detail: "Notes, links and files enter the shared context layer directly.",
    className: "active",
  },
  {
    name: "Conversation routing",
    state: "Manual handoff",
    detail: "Routing rules and handoffs are active. Automatic topic-shift detection requires a governed chat-history connector.",
    className: "partial",
  },
  {
    name: "Obsidian",
    state: "One-way handoff",
    detail: "Markdown export works today. A local connector is required for governed two-way sync.",
    className: "partial",
  },
  {
    name: "Company AVD",
    state: "Connector required",
    detail: "Bloomberg, Wind, Teams, Claude Code and company files must run inside the controlled environment.",
    className: "boundary",
  },
  {
    name: "Excel models",
    state: "Runner required",
    detail: "Model edits and validation stay in Excel or the company AVD; Level Grind stores tasks and audit trails.",
    className: "boundary",
  },
  {
    name: "Quant research",
    state: "Separate stack",
    detail: "Data, notebooks, backtests and portfolio tooling remain independent and return validated signals.",
    className: "separate",
  },
];

function markdown(doc: DocumentRecord) {
  return `---\nid: ${doc.id}\ntitle: "${doc.title.replaceAll('"', '\\"')}"\nauthor: "${doc.author_name}"\ncreated: ${doc.created_at}\nevent_date: ${doc.event_date || ""}\nproject: "${doc.project}"\ntopics: "${doc.topics}"\ncontext_scope: ${doc.context_scope}\nsource_system: "${doc.source_system}"\nconfidence: ${doc.confidence}\nsource_url: https://app.level-grind.com/documents/${doc.id}\n---\n\n# ${doc.title}\n\n${doc.body || ""}${doc.source_url ? `\n\n[Original source](${doc.source_url})` : ""}${doc.file_name ? `\n\n[Attachment](https://app.level-grind.com/api/files/${doc.id})` : ""}\n`;
}

export function Workspace() {
  const { getToken } = useAuth();
  const [active, setActive] = useState<View>("inbox");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [context, setContext] = useState<ContextPayload | null>(null);
  const [routing, setRouting] = useState<RoutingPayload | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [corpus, setCorpus] = useState<CorpusPayload | null>(null);
  const [askResult, setAskResult] = useState<AskResult | null>(null);
  const [asking, setAsking] = useState(false);
  const [importProgress, setImportProgress] = useState("");
  const [selected, setSelected] = useState<DocumentRecord | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [composer, setComposer] = useState(false);
  const [taskComposer, setTaskComposer] = useState(false);
  const [routingComposer, setRoutingComposer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const authorizedFetch = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const token = await getToken();
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  }, [getToken]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const scope = active === "personal" ? "personal" : "team";
      const [documentsResponse, contextResponse, routingResponse, membersResponse, corpusResponse] = await Promise.all([
        authorizedFetch(`/api/documents?scope=${scope}&q=${encodeURIComponent(query)}`),
        authorizedFetch("/api/context"),
        authorizedFetch("/api/routing"),
        authorizedFetch("/api/members"),
        authorizedFetch("/api/corpus"),
      ]);
      if (!documentsResponse.ok || !contextResponse.ok || !routingResponse.ok || !membersResponse.ok || !corpusResponse.ok) {
        throw new Error("The context workspace could not be loaded.");
      }
      const documentsData = (await documentsResponse.json()) as { documents: DocumentRecord[] };
      const contextData = (await contextResponse.json()) as ContextPayload;
      const routingData = (await routingResponse.json()) as RoutingPayload;
      const membersData = (await membersResponse.json()) as { members: TeamMember[] };
      const corpusData = (await corpusResponse.json()) as CorpusPayload;
      setDocuments(documentsData.documents ?? []);
      setContext(contextData);
      setRouting(routingData);
      setMembers(membersData.members ?? []);
      setCorpus(corpusData);
      setSelected((current) => {
        const next = (documentsData.documents ?? []).find((item) => item.id === current?.id);
        return next ?? documentsData.documents?.[0] ?? null;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [active, authorizedFetch, query]);

  async function importCorpus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("corpusFiles") as HTMLInputElement;
    const selectedFiles = Array.from(input.files ?? []);
    const manifestFile = selectedFiles.find((file) => file.name === "manifest.json");
    if (!manifestFile) {
      setError("Select manifest.json together with its PDF files.");
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
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error || `Import failed: ${record.title}`);
        completed += 1;
      }
      event.currentTarget.reset();
      setToast(`Imported ${completed} searchable reports`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Report import failed.");
    } finally {
      setSaving(false);
      setImportProgress("");
    }
  }

  async function askReports(event: FormEvent<HTMLFormElement>) {
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
        body: JSON.stringify({ question }),
      });
      const payload = (await response.json()) as AskResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "The report assistant could not answer.");
      setAskResult(payload);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The report assistant could not answer.");
    } finally {
      setAsking(false);
    }
  }

  async function openCorpusDocument(document: CorpusDocument) {
    const response = await authorizedFetch(`/api/corpus/files/${document.id}`);
    if (!response.ok) {
      setError("The report could not be opened.");
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function saveMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
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
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Member update failed.");
      event.currentTarget.reset();
      setToast("Team member saved");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Member update failed.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 160);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleDocuments = useMemo(() => {
    if (active === "personal") return documents.filter((doc) => doc.author_email === context?.user.email);
    return documents;
  }, [active, context?.user.email, documents]);

  async function submitMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await authorizedFetch("/api/documents", { method: "POST", body: new FormData(event.currentTarget) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Capture failed.");
      setComposer(false);
      event.currentTarget.reset();
      setToast("Saved with context");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Capture failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await authorizedFetch("/api/context", { method: "POST", body: new FormData(event.currentTarget) });
      if (!response.ok) throw new Error("Personal context could not be saved.");
      setToast("Personal context updated");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await authorizedFetch("/api/context", { method: "POST", body: new FormData(event.currentTarget) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Task context could not be saved.");
      setTaskComposer(false);
      event.currentTarget.reset();
      setToast("Task context is ready");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveRoutingPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await authorizedFetch("/api/routing", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      if (!response.ok) throw new Error("Routing preference could not be saved.");
      setToast("Conversation routing preference updated");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveWorkstream(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await authorizedFetch("/api/routing", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Workstream could not be saved.");
      setRoutingComposer(false);
      event.currentTarget.reset();
      setToast("Handoff context saved");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function downloadMarkdown(doc: DocumentRecord) {
    const blob = new Blob([markdown(doc)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${doc.title.replace(/[\\/:*?"<>|]+/g, "-")}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast("Markdown downloaded");
  }

  async function downloadFile(doc: DocumentRecord) {
    if (!doc.file_name) return;
    const response = await authorizedFetch(`/api/files/${doc.id}`);
    if (!response.ok) {
      setError("Attachment could not be downloaded.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = doc.file_name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function openObsidian(doc: DocumentRecord) {
    await navigator.clipboard.writeText(markdown(doc));
    const vault = window.localStorage.getItem("lg-obsidian-vault") || "Research";
    const file = `Level Grind/${doc.project}/${doc.title}`;
    window.location.href = `obsidian://new?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(file)}&clipboard=true`;
    setToast("Copied and sent to Obsidian");
  }

  const heading = {
    inbox: ["CAPTURE & ROUTE", "Research inbox", "Capture material once, then route it into personal or team context."],
    library: ["SEARCHABLE FILINGS", "Report library", "Annual and interim reports stored once, indexed by company and available from any device."],
    assistant: ["GROUNDED RESEARCH", "Ask the reports", "Search the report corpus and receive an answer with page-level citations."],
    personal: ["PERSONAL CONTEXT", "My research context", "Your coverage, working method, preferences and private memory."],
    team: ["SHARED INTELLIGENCE", "Team context", "Topics, provenance and signals the team is allowed to share."],
    tasks: ["MINIMUM SUFFICIENT CONTEXT", "Task context", "Package the right context for an agent without dumping the whole knowledge base."],
    routing: ["WORKSTREAM BOUNDARIES", "Conversation routing", "Keep each chat attached to one goal, then hand off cleanly when the work changes."],
    sources: ["TRUST BOUNDARIES", "System boundary", "Keep raw data where it belongs; move only governed context and results."],
  }[active];

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand"><span className="brand-mark">LG</span><span>Level Grind</span></div>
        <p className="workspace-label">CONTEXT INFRA</p>
        <nav aria-label="Workspace navigation">
          {navItems.map(([id, label, icon]) => (
            <button
              key={id}
              className={active === id ? "nav-item active" : "nav-item"}
              onClick={() => { setActive(id); setMobileNav(false); }}
            >
              <span>{icon}</span>{label}
              {id === "inbox" && <em>{documents.length}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="context-legend">
            <span><i className="dot personal-dot" /> Personal</span>
            <span><i className="dot team-dot" /> Team</span>
            <span><i className="dot task-dot" /> Task pack</span>
          </div>
          <div className="profile">
            <span className="avatar">{(context?.user.name || "LG").slice(0, 2).toUpperCase()}</span>
            <div><strong>{context?.user.name || "Workspace owner"}</strong><small>{context?.user.role || "private alpha"}</small></div>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open menu" onClick={() => setMobileNav(!mobileNav)}>☰</button>
          <div className="search">
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search topics, sources, people or projects…" />
            <kbd>⌘ K</kbd>
          </div>
          {active === "tasks" ? (
            <button className="upload-button" onClick={() => setTaskComposer(true)}>＋ New task context</button>
          ) : active === "routing" ? (
            <button className="upload-button" onClick={() => setRoutingComposer(true)}>＋ New handoff</button>
          ) : active === "library" || active === "assistant" ? null : (
            <button className="upload-button" onClick={() => setComposer(true)}>＋ Capture</button>
          )}
        </header>

        <div className="content">
          <div className="page-heading">
            <div><p className="eyebrow">{heading[0]}</p><h1>{heading[1]}</h1><p>{heading[2]}</p></div>
            <span className="system-state"><i /> Context layer online</span>
          </div>

          {error && <div className="inline-error">{error}<button onClick={load}>Try again</button></div>}

          {active === "inbox" && (
            <>
              <div className="metrics">
                <article><span>CAPTURED</span><strong>{documents.length}</strong><small>accessible items</small></article>
                <article><span>HIGH SIGNAL</span><strong>{context?.counts.high_signals || 0}</strong><small>need attention</small></article>
                <article><span>TOPICS</span><strong>{context?.topics.length || 0}</strong><small>active context lines</small></article>
              </div>
              <DocumentDesk
                loading={loading}
                documents={visibleDocuments}
                selected={selected}
                setSelected={setSelected}
                downloadMarkdown={downloadMarkdown}
                downloadFile={downloadFile}
                openObsidian={openObsidian}
                openCapture={() => setComposer(true)}
              />
            </>
          )}

          {active === "library" && (
            <section className="corpus-board">
              <div className="metrics">
                <article><span>REPORTS</span><strong>{corpus?.documents.length || 0}</strong><small>searchable PDFs</small></article>
                <article><span>COMPANIES</span><strong>{new Set(corpus?.documents.map((doc) => doc.security_code)).size}</strong><small>in the library</small></article>
                <article><span>PAGES</span><strong>{corpus?.documents.reduce((sum, doc) => sum + doc.page_count, 0) || 0}</strong><small>indexed pages</small></article>
              </div>
              {(context?.user.role === "owner" || context?.user.role === "admin") && (
                <form className="corpus-import" onSubmit={importCorpus}>
                  <div>
                    <p className="eyebrow">ADMIN IMPORT</p>
                    <h2>Add a verified report batch</h2>
                    <p>Select the batch manifest and every referenced PDF. Files go to cloud storage; extracted pages become searchable context.</p>
                  </div>
                  <label className="file-drop">
                    Select manifest + PDFs
                    <input name="corpusFiles" type="file" accept=".json,.pdf" multiple required />
                    <small>{importProgress || "CNINFO batch format"}</small>
                  </label>
                  <button className="upload-button" disabled={saving}>{saving ? "Importing…" : "Import batch"}</button>
                </form>
              )}
              {!corpus?.documents.length ? (
                <div className="empty-state"><h3>No reports in the cloud library yet.</h3><p>Import the verified CNINFO batch to make it available from every device.</p></div>
              ) : (
                <div className="corpus-grid">
                  {corpus.documents.map((document) => (
                    <article className="corpus-card" key={document.id}>
                      <div><span className="tag">{document.security_code}</span><span>{document.document_type === "annual-report" ? "Annual" : "Interim"}</span></div>
                      <h3>{document.company_name}</h3>
                      <p>{document.title}</p>
                      <small>{document.page_count} pages · {(document.file_size / 1048576).toFixed(1)} MB</small>
                      <button className="quiet-button" onClick={() => openCorpusDocument(document)}>Open report</button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {active === "assistant" && (
            <section className="assistant-board">
              <div className="usage-strip">
                <article><span>YOUR QUERIES</span><strong>{corpus?.usage.query_count || 0}</strong></article>
                <article><span>INPUT TOKENS</span><strong>{Number(corpus?.usage.input_tokens || 0).toLocaleString()}</strong></article>
                <article><span>OUTPUT TOKENS</span><strong>{Number(corpus?.usage.output_tokens || 0).toLocaleString()}</strong></article>
                <article><span>EST. COST</span><strong>${Number(corpus?.usage.estimated_cost_usd || 0).toFixed(4)}</strong></article>
              </div>
              <form className="ask-box" onSubmit={askReports}>
                <p className="eyebrow">REPORT ASSISTANT</p>
                <h2>Ask across the team report library.</h2>
                <textarea name="question" required rows={4} placeholder="例如：比较中兴通讯和光环新网在 2025 年对 AI 基础设施需求的表述，并标明出处。" />
                <div className="composer-foot"><span>Answers are restricted to indexed report evidence</span><button className="upload-button" disabled={asking || !corpus?.documents.length}>{asking ? "Reading reports…" : "Ask"}</button></div>
              </form>
              {askResult && (
                <article className="answer-card">
                  <div className="section-title"><h2>Answer</h2><span>{askResult.usage ? `${askResult.usage.provider} · ${askResult.usage.model}` : "Retrieved evidence"}</span></div>
                  <div className="answer-copy">{askResult.answer}</div>
                  <div className="citation-list">
                    {askResult.citations.map((citation) => (
                      <button key={`${citation.documentId}-${citation.page}`} onClick={() => {
                        const document = corpus?.documents.find((item) => item.id === citation.documentId);
                        if (document) openCorpusDocument(document);
                      }}>
                        [{citation.index}] {citation.company} · {citation.title} · p.{citation.page}
                      </button>
                    ))}
                  </div>
                </article>
              )}
              {(context?.user.role === "owner" || context?.user.role === "admin") && Boolean(corpus?.memberUsage.length) && (
                <section className="member-usage">
                  <div className="section-title"><h2>Team AI usage</h2><span>Operations view</span></div>
                  {corpus?.memberUsage.map((usage) => (
                    <article key={usage.user_email}><span>{usage.user_email}</span><b>{usage.query_count} queries</b><span>{Number(usage.total_tokens).toLocaleString()} tokens</span><span>${Number(usage.estimated_cost_usd).toFixed(4)}</span></article>
                  ))}
                </section>
              )}
            </section>
          )}

          {active === "personal" && context && (
            <div className="context-layout">
              <form className="context-form" onSubmit={saveProfile}>
                <input type="hidden" name="action" value="profile" />
                <div className="section-title"><div><p className="eyebrow">PRIVATE BY DEFAULT</p><h2>How you research</h2></div><span>Only you can edit</span></div>
                <label>Coverage universe<textarea name="coverage" rows={3} defaultValue={context.personal.coverage} placeholder="Companies, sectors, commodities and regions you own…" /></label>
                <label>Output preferences<textarea name="outputPreferences" rows={3} defaultValue={context.personal.output_preferences} placeholder="Concise, causal chain first, sources beside claims…" /></label>
                <label>Working method<textarea name="workingMethod" rows={4} defaultValue={context.personal.working_method} placeholder="How you form hypotheses, validate evidence and update models…" /></label>
                <label>Private working memory<textarea name="privateMemory" rows={5} defaultValue={context.personal.private_memory} placeholder="Current theses, watchlist, unresolved questions and personal reminders…" /></label>
                <div className="composer-foot"><span>Shared only through explicit task context</span><button className="upload-button" disabled={saving}>{saving ? "Saving…" : "Save context"}</button></div>
              </form>
              <section className="context-explainer">
                <p className="eyebrow">PERSONAL CONTEXT</p>
                <h2>Not another document folder.</h2>
                <p>Personal context teaches the system what you cover, how you reason, what you are tracking and how you want evidence presented.</p>
                <div className="context-flow"><span>Your sources</span><b>→</b><span>Your method</span><b>→</b><span>Task pack</span></div>
                <p className="boundary-note">Raw Obsidian vaults, Excel models and company data can stay in their original systems.</p>
              </section>
            </div>
          )}

          {active === "team" && context && (
            <>
              <div className="metrics">
                <article><span>TEAM CONTEXT</span><strong>{context.counts.team_items || 0}</strong><small>shared items</small></article>
                <article><span>PERSONAL SOURCES</span><strong>{context.counts.personal_items || 0}</strong><small>owned by you</small></article>
                <article><span>SOURCE TYPES</span><strong>{context.sources.length}</strong><small>with provenance</small></article>
              </div>
              <div className="team-grid">
                <section className="topic-panel">
                  <div className="section-title"><h2>Topic lines</h2><span>Newest signal first</span></div>
                  {context.topics.length === 0 ? <div className="state-card">Capture material with topics to start the team timeline.</div> :
                    context.topics.map((topic) => (
                      <article className="topic-row" key={topic.topic}>
                        <span className="topic-orbit" />
                        <div><strong>{topic.topic || "General"}</strong><small>Last signal {new Date(topic.last_signal).toLocaleDateString()}</small></div>
                        <b>{topic.item_count}</b>
                      </article>
                    ))}
                </section>
                <section className="topic-panel">
                  <div className="section-title"><h2>Provenance</h2><span>Where context comes from</span></div>
                  {context.sources.length === 0 ? <div className="state-card">No sources captured yet.</div> :
                    context.sources.map((source) => (
                      <article className="source-row" key={source.source}><span>{source.source}</span><b>{source.item_count}</b></article>
                    ))}
                  <div className="policy-strip"><strong>Team context rule</strong><p>Share normalized entities, timelines and approved conclusions—not every raw source.</p></div>
                </section>
              </div>
              <section className="member-panel">
                <div className="section-title">
                  <div><p className="eyebrow">MULTI-USER ALPHA</p><h2>Team access</h2></div>
                  <span>{members.filter((member) => member.status === "active").length} active members</span>
                </div>
                <div className="member-list">
                  {members.map((member) => (
                    <article className="member-row" key={member.email}>
                      <span className="avatar">{(member.display_name || member.email).slice(0, 2).toUpperCase()}</span>
                      <div><strong>{member.display_name || member.email.split("@")[0]}</strong><small>{member.email}</small></div>
                      <span className={`member-role role-${member.role}`}>{member.role}</span>
                      <span className={`member-status status-${member.status}`}>{member.status}</span>
                    </article>
                  ))}
                </div>
                {(context.user.role === "owner" || context.user.role === "admin") && (
                  <form className="member-form" onSubmit={saveMember}>
                    <label>Name<input name="displayName" maxLength={120} placeholder="Team member" /></label>
                    <label>Email<input name="email" type="email" required placeholder="analyst@company.com" /></label>
                    <label>Role<select name="role"><option value="member">Member</option><option value="admin">Admin</option></select></label>
                    <button className="upload-button" disabled={saving}>{saving ? "Saving…" : "Add or update"}</button>
                  </form>
                )}
              </section>
            </>
          )}

          {active === "tasks" && (
            <section className="task-board">
              <div className="task-principle">
                <p className="eyebrow">TASK CONTEXT BUILDER</p>
                <h2>Give the agent enough context—not all context.</h2>
                <div className="task-equation"><span>Objective</span><b>＋</b><span>Personal method</span><b>＋</b><span>Approved team evidence</span><b>＋</b><span>Guardrails</span></div>
              </div>
              <div className="section-title"><h2>Prepared task packs</h2><button className="quiet-button" onClick={() => setTaskComposer(true)}>New task</button></div>
              {!context?.tasks.length ? <div className="empty-state"><h3>No task context yet.</h3><p>Prepare a research or model-update task with explicit scope, sources and output rules.</p><button className="upload-button" onClick={() => setTaskComposer(true)}>Create the first task</button></div> :
                <div className="task-list">{context.tasks.map((task) => (
                  <article className="task-card" key={task.id}>
                    <div><span className="tag">{task.topic}</span><span className="task-status">{task.status}</span></div>
                    <h3>{task.title}</h3><p>{task.objective}</p>
                    <dl><div><dt>Context</dt><dd>{task.context_scope}</dd></div><div><dt>Output</dt><dd>{task.output_format}</dd></div></dl>
                    {task.guardrails && <small>Guardrails · {task.guardrails}</small>}
                  </article>
                ))}</div>}
            </section>
          )}

          {active === "routing" && routing && (
            <section className="routing-board">
              <div className="routing-intro">
                <div>
                  <p className="eyebrow">CONVERSATION ROUTING</p>
                  <h2>One chat, one active goal.</h2>
                  <p>
                    Save the current workstream before the topic drifts. A future chat connector can
                    detect the shift automatically; today the handoff is explicit and reviewable.
                  </p>
                </div>
                <span className="boundary-status partial">Manual routing active</span>
              </div>

              <div className="routing-grid">
                <form className="routing-policy" onSubmit={saveRoutingPolicy}>
                  <input type="hidden" name="action" value="policy" />
                  <div className="section-title">
                    <h2>Your routing rule</h2>
                    <span>Personal context</span>
                  </div>
                  <label className="toggle-row">
                    <input
                      name="reminderEnabled"
                      type="checkbox"
                      defaultChecked={Boolean(routing.policy.reminder_enabled)}
                    />
                    <span>
                      <strong>Remind me when the workstream changes</strong>
                      <small>Use the saved rule when a conversation connector is available.</small>
                    </span>
                  </label>
                  <label className="routing-rule">
                    Trigger rule
                    <textarea
                      name="triggerRules"
                      rows={5}
                      defaultValue={routing.policy.trigger_rules}
                    />
                  </label>
                  <div className="composer-foot">
                    <span>Stored privately for your account</span>
                    <button className="upload-button" disabled={saving}>
                      {saving ? "Saving…" : "Save rule"}
                    </button>
                  </div>
                </form>

                <section className="routing-guide">
                  <div className="section-title"><h2>Where should the work go?</h2><span>Decision guide</span></div>
                  <article>
                    <b>Continue</b>
                    <div><strong>Same goal and deliverable</strong><p>A short tangent still supports the original outcome.</p></div>
                  </article>
                  <article>
                    <b>New chat</b>
                    <div><strong>New goal inside the same project</strong><p>The deliverable changes, but the people, data boundary, and project remain related.</p></div>
                  </article>
                  <article>
                    <b>New project</b>
                    <div><strong>New repository or long-term workstream</strong><p>The data, permissions, stakeholders, or sustained objective has changed.</p></div>
                  </article>
                </section>
              </div>

              <div className="section-title routing-list-title">
                <div><p className="eyebrow">SAVED HANDOFFS</p><h2>Workstream register</h2></div>
                <button className="quiet-button" onClick={() => setRoutingComposer(true)}>New handoff</button>
              </div>

              {routing.workstreams.length === 0 ? (
                <div className="empty-state routing-empty">
                  <h3>No conversation handoffs yet.</h3>
                  <p>Save a workstream when a chat starts producing a different deliverable or belongs to another project.</p>
                  <button className="upload-button" onClick={() => setRoutingComposer(true)}>Save the first handoff</button>
                </div>
              ) : (
                <div className="workstream-list">
                  {routing.workstreams.map((workstream) => (
                    <article className="workstream-card" key={workstream.id}>
                      <div className="workstream-top">
                        <span className="tag">{workstream.project_name}</span>
                        <span className={`route-action route-${workstream.recommended_action}`}>
                          {routingLabels[workstream.recommended_action]}
                        </span>
                      </div>
                      <h3>{workstream.chat_title}</h3>
                      <dl>
                        <div><dt>Active goal</dt><dd>{workstream.active_goal}</dd></div>
                        {workstream.deliverable && <div><dt>Deliverable</dt><dd>{workstream.deliverable}</dd></div>}
                        {workstream.shift_reason && <div><dt>Why it shifted</dt><dd>{workstream.shift_reason}</dd></div>}
                      </dl>
                      {workstream.handoff_summary && (
                        <div className="handoff-note"><strong>Handoff</strong><p>{workstream.handoff_summary}</p></div>
                      )}
                      <small>Updated {new Date(workstream.updated_at).toLocaleString()}</small>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {active === "sources" && (
            <>
              <div className="boundary-map">
                <div className="outside-zone"><span>RAW SYSTEMS</span><strong>Obsidian · BBG · Wind · WeChat · Teams · Excel</strong></div>
                <b>Governed connectors ↓</b>
                <div className="inside-zone"><span>LEVEL GRIND OWNS</span><strong>Context · permissions · provenance · tasks · timelines · results</strong></div>
                <b>Validated outputs ↕</b>
                <div className="outside-zone"><span>SPECIALIZED COMPUTE</span><strong>AVD agents · Excel runner · Quant research stack</strong></div>
              </div>
              <div className="source-grid">{sourceBoundaries.map((source) => (
                <article className="source-card" key={source.name}>
                  <span className={`boundary-status ${source.className}`}>{source.state}</span>
                  <h3>{source.name}</h3><p>{source.detail}</p>
                </article>
              ))}</div>
            </>
          )}
        </div>
      </section>

      {composer && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setComposer(false)}>
          <form className="composer" onSubmit={submitMaterial}>
            <div className="composer-head"><div><p className="eyebrow">CONTEXT-AWARE CAPTURE</p><h2>Add research material</h2></div><button type="button" onClick={() => setComposer(false)}>×</button></div>
            <label>Title<input name="title" required maxLength={180} placeholder="What should the system remember?" autoFocus /></label>
            <label>Notes<textarea name="body" rows={4} placeholder="Facts, thesis, meeting takeaways or model implications…" /></label>
            <div className="form-grid">
              <label>Topic / project<input name="project" placeholder="AI Models" /></label>
              <label>Context scope<select name="contextScope"><option value="team">Team context</option><option value="personal">Personal context</option></select></label>
            </div>
            <div className="form-grid">
              <label>Source system<select name="sourceSystem"><option value="manual">Manual note</option><option value="wechat">WeChat</option><option value="meeting">Meeting</option><option value="bloomberg">Bloomberg</option><option value="wind">Wind</option><option value="filing">Company filing</option><option value="obsidian">Obsidian</option><option value="excel">Excel model</option><option value="research-agent">Research agent</option></select></label>
              <label>Event date<input name="eventDate" type="date" /></label>
            </div>
            <div className="form-grid">
              <label>Topics<input name="topics" placeholder="Kimi K3, model eval, cloud" /></label>
              <label>Confidence<select name="confidence"><option value="medium">Medium</option><option value="high">High</option><option value="low">Low</option></select></label>
            </div>
            <label>Source link<input name="sourceUrl" type="url" placeholder="https://…" /></label>
            <label>Signal level<select name="importance"><option value="normal">Normal</option><option value="high">High signal</option></select></label>
            <input ref={fileRef} name="file" type="file" className="file-input" />
            <button className="file-drop" type="button" onClick={() => fileRef.current?.click()}>＋ Attach PDF, spreadsheet, image or document <small>Up to 25 MB</small></button>
            <div className="composer-foot"><span>Source and scope stay attached</span><button className="upload-button" disabled={saving}>{saving ? "Saving…" : "Save material"}</button></div>
          </form>
        </div>
      )}

      {taskComposer && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setTaskComposer(false)}>
          <form className="composer" onSubmit={saveTask}>
            <input type="hidden" name="action" value="task" />
            <div className="composer-head"><div><p className="eyebrow">TASK CONTEXT</p><h2>Prepare an agent task</h2></div><button type="button" onClick={() => setTaskComposer(false)}>×</button></div>
            <label>Task title<input name="title" required placeholder="Update Q2 financial model" autoFocus /></label>
            <label>Objective<textarea name="objective" required rows={4} placeholder="What outcome must the task produce?" /></label>
            <div className="form-grid">
              <label>Topic<input name="topic" placeholder="Company / research line" /></label>
              <label>Allowed context<select name="contextScope"><option value="personal+team">Personal + approved team</option><option value="personal">Personal only</option><option value="team">Team only</option><option value="public">Public sources only</option></select></label>
            </div>
            <label>Output format<input name="outputFormat" defaultValue="Concise brief with sources" /></label>
            <label>Guardrails<textarea name="guardrails" rows={3} placeholder="Do not alter formulas; distinguish facts from inference; stop on mapping ambiguity…" /></label>
            <div className="composer-foot"><span>Execution connector is selected later</span><button className="upload-button" disabled={saving}>{saving ? "Saving…" : "Prepare task"}</button></div>
          </form>
        </div>
      )}

      {routingComposer && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setRoutingComposer(false)}>
          <form className="composer" onSubmit={saveWorkstream}>
            <input type="hidden" name="action" value="workstream" />
            <div className="composer-head">
              <div><p className="eyebrow">CONTEXT HANDOFF</p><h2>Route this conversation</h2></div>
              <button type="button" onClick={() => setRoutingComposer(false)}>×</button>
            </div>
            <div className="form-grid">
              <label>Project<input name="projectName" required placeholder="Team research & interviews" autoFocus /></label>
              <label>Current chat<input name="chatTitle" required placeholder="Qitian profile and needs" /></label>
            </div>
            <label>Active goal<textarea name="activeGoal" required rows={3} placeholder="What outcome was this chat originally meant to produce?" /></label>
            <label>Current deliverable<input name="deliverable" placeholder="Profile document, product spec, code change…" /></label>
            <label>Why does this feel like a different workstream?<textarea name="shiftReason" rows={3} placeholder="The discussion moved from colleague profiles into a separate software repository and deployment workflow." /></label>
            <label>Recommended route<select name="recommendedAction" defaultValue="new-chat"><option value="continue">Continue current chat</option><option value="new-chat">Start a new chat in this project</option><option value="new-project">Start a new project</option></select></label>
            <label>Handoff summary<textarea name="handoffSummary" rows={5} placeholder="Key context, decisions, files, open questions, and the next action for the new chat." /></label>
            <div className="composer-foot">
              <span>Only the handoff context is saved—not a hidden copy of the whole chat</span>
              <button className="upload-button" disabled={saving}>{saving ? "Saving…" : "Save handoff"}</button>
            </div>
          </form>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function DocumentDesk({
  loading, documents, selected, setSelected, downloadMarkdown, downloadFile, openObsidian, openCapture,
}: {
  loading: boolean;
  documents: DocumentRecord[];
  selected: DocumentRecord | null;
  setSelected: (doc: DocumentRecord) => void;
  downloadMarkdown: (doc: DocumentRecord) => void;
  downloadFile: (doc: DocumentRecord) => void;
  openObsidian: (doc: DocumentRecord) => void;
  openCapture: () => void;
}) {
  return (
    <div className="desk">
      <section className="feed">
        <div className="section-title"><h2>Recent material</h2><span>{documents.length} items</span></div>
        {loading && <div className="state-card">Loading context…</div>}
        {!loading && documents.length === 0 && (
          <div className="empty-state"><div className="empty-orbit">＋</div><h3>Your context inbox is ready.</h3><p>Capture a note, link, filing or spreadsheet with source and scope.</p><button className="upload-button" onClick={openCapture}>Capture the first item</button></div>
        )}
        {!loading && documents.map((doc) => (
          <button key={doc.id} className={selected?.id === doc.id ? "feed-item selected" : "feed-item"} onClick={() => setSelected(doc)}>
            <span className={`kind-icon kind-${doc.kind}`}>{doc.kind === "file" ? "F" : doc.kind === "link" ? "↗" : "N"}</span>
            <span className="feed-main">
              <strong>{doc.title}</strong>
              <small>{doc.body || doc.file_name || doc.source_url || "No preview available"}</small>
              <span className="meta"><b>{doc.topics || doc.project}</b> · {doc.source_system} · {doc.event_date || new Date(doc.created_at).toLocaleDateString()}</span>
            </span>
            <span className={`scope-pill scope-${doc.context_scope}`}>{doc.context_scope}</span>
          </button>
        ))}
      </section>
      <aside className="detail">
        {selected ? (
          <>
            <div className="detail-top"><span className="tag">{selected.topics || selected.project}</span><span className={`confidence confidence-${selected.confidence}`}>{selected.confidence} confidence</span></div>
            <h2>{selected.title}</h2>
            <p className="detail-meta">{selected.source_system} · {selected.author_name} · {selected.event_date || new Date(selected.created_at).toLocaleDateString()}</p>
            <div className="detail-body">{selected.body || "This item contains an attachment or external source."}</div>
            {selected.source_url && <a className="source-link" href={selected.source_url} target="_blank" rel="noreferrer">Open original source ↗</a>}
            {selected.file_name && <button className="source-link file-link-button" onClick={() => downloadFile(selected)}>Download {selected.file_name}</button>}
            <div className="detail-actions"><button onClick={() => downloadMarkdown(selected)}>↓ Markdown</button><button className="obsidian-button" onClick={() => openObsidian(selected)}>Open in Obsidian ↗</button></div>
            <div className="freshness"><span>●</span><div><strong>{selected.context_scope === "personal" ? "Personal context" : "Approved team context"}</strong><small>Source, date and scope travel with this item.</small></div></div>
          </>
        ) : <div className="detail-placeholder">Select an item to inspect its context.</div>}
      </aside>
    </div>
  );
}
