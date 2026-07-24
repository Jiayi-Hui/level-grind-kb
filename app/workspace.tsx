"use client";

import { useAuth } from "@clerk/react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type View = "inbox" | "personal" | "team" | "tasks" | "sources";

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
  user: { email: string; name: string };
  personal: PersonalContext;
  tasks: ContextTask[];
  topics: Array<{ topic: string; item_count: number; last_signal: string }>;
  sources: Array<{ source: string; item_count: number }>;
  counts: { personal_items: number; team_items: number; high_signals: number };
};

const navItems: Array<[View, string, string]> = [
  ["inbox", "Research inbox", "⌂"],
  ["personal", "My context", "◌"],
  ["team", "Team context", "◎"],
  ["tasks", "Task context", "◇"],
  ["sources", "System boundary", "⊙"],
];

const sourceBoundaries = [
  {
    name: "Web capture",
    state: "Active",
    detail: "Notes, links and files enter the shared context layer directly.",
    className: "active",
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
  const [selected, setSelected] = useState<DocumentRecord | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [composer, setComposer] = useState(false);
  const [taskComposer, setTaskComposer] = useState(false);
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
      const [documentsResponse, contextResponse] = await Promise.all([
        authorizedFetch(`/api/documents?scope=${scope}&q=${encodeURIComponent(query)}`),
        authorizedFetch("/api/context"),
      ]);
      if (!documentsResponse.ok || !contextResponse.ok) {
        throw new Error("The context workspace could not be loaded.");
      }
      const documentsData = (await documentsResponse.json()) as { documents: DocumentRecord[] };
      const contextData = (await contextResponse.json()) as ContextPayload;
      setDocuments(documentsData.documents ?? []);
      setContext(contextData);
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
    personal: ["PERSONAL CONTEXT", "My research context", "Your coverage, working method, preferences and private memory."],
    team: ["SHARED INTELLIGENCE", "Team context", "Topics, provenance and signals the team is allowed to share."],
    tasks: ["MINIMUM SUFFICIENT CONTEXT", "Task context", "Package the right context for an agent without dumping the whole knowledge base."],
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
            <div><strong>{context?.user.name || "Workspace owner"}</strong><small>Private preview</small></div>
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
          ) : (
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
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function DocumentDesk({
  loading, documents, selected, setSelected, downloadMarkdown, openObsidian, openCapture,
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
