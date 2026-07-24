"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
};

const navItems = [
  ["mine", "My inbox", "⌂"],
  ["team", "Team pulse", "◉"],
  ["projects", "Projects", "◇"],
  ["pm", "PM view", "◎"],
] as const;

function markdown(doc: DocumentRecord) {
  return `---\nid: ${doc.id}\ntitle: "${doc.title.replaceAll('"', '\\"')}"\nauthor: "${doc.author_name}"\ncreated: ${doc.created_at}\nproject: "${doc.project}"\nimportance: ${doc.importance}\nsource_url: https://app.level-grind.com/documents/${doc.id}\n---\n\n# ${doc.title}\n\n${doc.body || ""}${doc.source_url ? `\n\n[Original source](${doc.source_url})` : ""}${doc.file_name ? `\n\n[Attachment](https://app.level-grind.com/api/files/${doc.id})` : ""}\n\n---\n[View the latest team version](https://app.level-grind.com/documents/${doc.id})\n`;
}

export function Workspace() {
  const [active, setActive] = useState("mine");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selected, setSelected] = useState<DocumentRecord | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [composer, setComposer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const scope = active === "mine" ? "mine" : "team";
      const response = await fetch(`/api/documents?scope=${scope}&q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("The workspace could not be loaded.");
      const data = (await response.json()) as {
        documents: DocumentRecord[];
        user: { email: string; name: string };
      };
      setDocuments(data.documents ?? []);
      setSelected((current) => {
        const next = (data.documents ?? []).find((item: DocumentRecord) => item.id === current?.id);
        return next ?? data.documents?.[0] ?? null;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [active, query]);

  useEffect(() => {
    const timer = window.setTimeout(load, 180);
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

  const grouped = useMemo(() => {
    if (active !== "projects") return documents;
    return [...documents].sort((a, b) => a.project.localeCompare(b.project));
  }, [active, documents]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Upload failed.");
      setComposer(false);
      event.currentTarget.reset();
      setToast("Saved to the team workspace");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
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

  async function openObsidian(doc: DocumentRecord) {
    await navigator.clipboard.writeText(markdown(doc));
    const vault = window.localStorage.getItem("lg-obsidian-vault") || "Research";
    const file = `Level Grind/${doc.project}/${doc.title}`;
    window.location.href = `obsidian://new?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(file)}&clipboard=true`;
    setToast("Copied and sent to Obsidian");
  }

  const totalSize = documents.reduce((sum, item) => sum + (item.file_size || 0), 0);

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">LG</span>
          <span>Level Grind</span>
        </div>
        <p className="workspace-label">RESEARCH WORKSPACE</p>
        <nav aria-label="Workspace navigation">
          {navItems.map(([id, label, icon]) => (
            <button
              key={id}
              className={active === id ? "nav-item active" : "nav-item"}
              onClick={() => { setActive(id); setMobileNav(false); }}
            >
              <span>{icon}</span>{label}
              {id === "mine" && <em>{documents.length}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item"><span>⚙</span>Settings</button>
          <div className="profile">
            <span className="avatar">HG</span>
            <div><strong>Workspace owner</strong><small>Admin · PM</small></div>
            <span>•••</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open menu" onClick={() => setMobileNav(!mobileNav)}>☰</button>
          <div className="search">
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes, files, people or projects…" />
            <kbd>⌘ K</kbd>
          </div>
          <button className="icon-button" aria-label="Notifications">♢</button>
          <button className="upload-button" onClick={() => setComposer(true)}>＋ Capture</button>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">{active === "mine" ? "YOUR RESEARCH FLOW" : "SHARED INTELLIGENCE"}</p>
              <h1>{navItems.find(([id]) => id === active)?.[1]}</h1>
              <p>{active === "mine" ? "Capture once. Find it everywhere." : "The team’s latest signals, in one place."}</p>
            </div>
            <div className="view-actions">
              <button className="quiet-button">This week⌄</button>
              <button className="quiet-button">Filter</button>
            </div>
          </div>

          <div className="metrics">
            <article><span>CAPTURED</span><strong>{documents.length}</strong><small>items in view</small></article>
            <article><span>PROJECTS</span><strong>{new Set(documents.map((item) => item.project)).size}</strong><small>active topics</small></article>
            <article><span>ATTACHMENTS</span><strong>{documents.filter((item) => item.file_name).length}</strong><small>{(totalSize / 1024 / 1024).toFixed(1)} MB stored</small></article>
          </div>

          <div className="desk">
            <section className="feed">
              <div className="section-title"><h2>Recent material</h2><span>{documents.length} items</span></div>
              {loading && <div className="state-card">Loading your workspace…</div>}
              {!loading && error && <div className="state-card error">{error}<button onClick={load}>Try again</button></div>}
              {!loading && !error && grouped.length === 0 && (
                <div className="empty-state">
                  <div className="empty-orbit">＋</div>
                  <h3>Your research inbox is ready.</h3>
                  <p>Save a note, link, PDF or spreadsheet. It will be available from every device.</p>
                  <button className="upload-button" onClick={() => setComposer(true)}>Capture the first item</button>
                </div>
              )}
              {!loading && grouped.map((doc) => (
                <button key={doc.id} className={selected?.id === doc.id ? "feed-item selected" : "feed-item"} onClick={() => setSelected(doc)}>
                  <span className={`kind-icon kind-${doc.kind}`}>{doc.kind === "file" ? "F" : doc.kind === "link" ? "↗" : "N"}</span>
                  <span className="feed-main">
                    <strong>{doc.title}</strong>
                    <small>{doc.body || doc.file_name || doc.source_url || "No preview available"}</small>
                    <span className="meta"><b>{doc.project}</b> · {doc.author_name} · {new Date(doc.created_at).toLocaleDateString()}</span>
                  </span>
                  {doc.importance === "high" && <span className="signal">HIGH</span>}
                </button>
              ))}
            </section>

            <aside className="detail">
              {selected ? (
                <>
                  <div className="detail-top"><span className="tag">{selected.project}</span><button>•••</button></div>
                  <h2>{selected.title}</h2>
                  <p className="detail-meta">Added by {selected.author_name} · {new Date(selected.created_at).toLocaleString()}</p>
                  <div className="detail-body">{selected.body || "This item contains an attachment or external source."}</div>
                  {selected.source_url && <a className="source-link" href={selected.source_url} target="_blank" rel="noreferrer">Open original source ↗</a>}
                  {selected.file_name && <a className="source-link" href={`/api/files/${selected.id}`}>Download {selected.file_name}</a>}
                  <div className="detail-actions">
                    <button onClick={() => downloadMarkdown(selected)}>↓ Markdown</button>
                    <button className="obsidian-button" onClick={() => openObsidian(selected)}>Open in Obsidian ↗</button>
                  </div>
                  <div className="freshness"><span>●</span><div><strong>Web version is current</strong><small>This workspace remains the source of truth.</small></div></div>
                </>
              ) : (
                <div className="detail-placeholder">Select an item to preview it here.</div>
              )}
            </aside>
          </div>
        </div>
      </section>

      {composer && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setComposer(false)}>
          <form className="composer" onSubmit={submit}>
            <div className="composer-head"><div><p className="eyebrow">QUICK CAPTURE</p><h2>Add to the workspace</h2></div><button type="button" onClick={() => setComposer(false)}>×</button></div>
            <label>Title<input name="title" required maxLength={180} placeholder="What should the team remember?" autoFocus /></label>
            <label>Notes<textarea name="body" rows={5} placeholder="Paste notes, a thesis, meeting takeaways…" /></label>
            <div className="form-grid">
              <label>Project<input name="project" placeholder="General" /></label>
              <label>Importance<select name="importance"><option value="normal">Normal</option><option value="high">High signal</option></select></label>
            </div>
            <label>Source link<input name="sourceUrl" type="url" placeholder="https://…" /></label>
            <input ref={fileRef} name="file" type="file" className="file-input" />
            <button className="file-drop" type="button" onClick={() => fileRef.current?.click()}>＋ Attach PDF, spreadsheet, image or document <small>Up to 25 MB in this preview</small></button>
            <div className="composer-foot"><span>Visible to your team</span><button className="upload-button" disabled={saving}>{saving ? "Saving…" : "Save material"}</button></div>
          </form>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
