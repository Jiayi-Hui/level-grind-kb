import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";

type Note = {
  id: string;
  title: string;
  body?: string;
  sensitivityLevel: "public" | "internal" | "confidential" | "restricted";
  aiProcessingAllowed: boolean;
  externalSearchAllowed: boolean;
  downloadAllowed: boolean;
  sourceKind: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  owner: { display_name?: string; email?: string };
};

const demoNotes: Note[] = [
  {
    id: "demo-note-idc-pricing",
    title: "AI data centre pricing · meeting notes",
    body: "Synthetic demonstration note. Review signed contract pricing, utilisation and bid cadence against source documents before any investment decision.",
    sensitivityLevel: "public",
    aiProcessingAllowed: false,
    externalSearchAllowed: false,
    downloadAllowed: false,
    sourceKind: "synthetic_demo",
    version: 1,
    createdAt: "2026-08-03T02:00:00.000Z",
    updatedAt: "2026-08-03T02:00:00.000Z",
    owner: { display_name: "Demo Analyst" },
  },
  {
    id: "demo-note-consumer-tracker",
    title: "Consumer internet weekly tracker",
    body: "Synthetic demonstration note. Follow advertising demand and management commentary; this is not a team research conclusion.",
    sensitivityLevel: "public",
    aiProcessingAllowed: false,
    externalSearchAllowed: false,
    downloadAllowed: false,
    sourceKind: "synthetic_demo · partial",
    version: 2,
    createdAt: "2026-08-02T09:00:00.000Z",
    updatedAt: "2026-08-02T09:00:00.000Z",
    owner: { display_name: "Demo Analyst" },
  },
];

type PreviewState = "ready" | "loading" | "empty" | "error" | "uploading" | "processing" | "partial" | "ocr_required" | "failed" | "conflict" | "success";
type Attachment = {
  id: string;
  fileName: string;
  mediaType?: string;
  byteSize: number;
  uploadStatus: "initialized" | "uploaded" | "failed";
  parseStatus: "queued" | "processing" | "ready" | "partial" | "needs_review" | "failed";
  parseErrorCode?: string;
  version: number;
  previewUrl?: string;
  extraction?: { status?: string; pageCount?: number; paragraphCount?: number; warnings?: string[]; text?: string };
};
const demoMode = import.meta.env.VITE_UI_FIXTURES === "true";
const sharedWriteEnabled = import.meta.env.VITE_SHARED_NOTES_WRITE_ENABLED !== "false";
const realReadEnabled = import.meta.env.VITE_SHARED_NOTES_READ_ENABLED !== "false";

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}
function attachmentLabel(attachment: Attachment) {
  if (attachment.parseErrorCode === "PARSING_DEFERRED") return "已上传 · 解析待上线";
  if (attachment.parseStatus === "needs_review") return "需要人工审核 / OCR";
  if (attachment.parseStatus === "failed" || attachment.uploadStatus === "failed") return "解析失败";
  if (attachment.parseStatus === "ready" || attachment.parseStatus === "partial") return "解析完成";
  if (attachment.uploadStatus === "initialized") return "等待直传";
  return "后台解析中";
}
function safePreviewUrl(value?: string) {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === "https:" ? url.toString() : null; } catch { return null; }
}
function documentKind(attachment: Attachment) {
  const name = attachment.fileName.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "md";
  return "txt";
}
function ReadonlyTextPreview({ text, markdown }: { text: string; markdown: boolean }) {
  return <article className={`document-text-preview ${markdown ? "markdown" : "plain"}`} aria-label="只读正文预览">{text.split(/\r?\n/).map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <br key={`gap-${index}`} />;
    if (markdown && /^#{1,3}\s+/.test(trimmed)) { const level = trimmed.match(/^#+/)?.[0].length || 1; const Tag = (`h${Math.min(level, 3)}` as "h1" | "h2" | "h3"); return <Tag key={index}>{trimmed.replace(/^#{1,3}\s+/, "")}</Tag>; }
    if (markdown && /^[-*]\s+/.test(trimmed)) return <li key={index}>{trimmed.replace(/^[-*]\s+/, "")}</li>;
    if (markdown && /^>\s?/.test(trimmed)) return <blockquote key={index}>{trimmed.replace(/^>\s?/, "")}</blockquote>;
    return <p key={index}>{trimmed}</p>;
  })}</article>;
}

async function responseJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "共享 Notes 服务暂时不可用。");
  return payload;
}

export function SharedNotesView() {
  const { getToken } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState<Note[]>(() => demoMode ? demoNotes : []);
  const [selected, setSelected] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sourceKind, setSourceKind] = useState("manual_note");
  const [sensitivityLevel, setSensitivityLevel] = useState<Note["sensitivityLevel"]>("internal");
  const [aiProcessingAllowed, setAiProcessingAllowed] = useState(false);
  const [externalSearchAllowed, setExternalSearchAllowed] = useState(false);
  const [downloadAllowed, setDownloadAllowed] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(demoMode || realReadEnabled);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [unavailable, setUnavailable] = useState(!demoMode && !realReadEnabled);
  const [previewState, setPreviewState] = useState<PreviewState>("ready");
  const [configured, setConfigured] = useState(false);
  const [ingestionFrozen, setIngestionFrozen] = useState(true);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [queuedFile, setQueuedFile] = useState<File | null>(null);
  const [writeConfirmation, setWriteConfirmation] = useState<string>("");
  const [previewAttachmentId, setPreviewAttachmentId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState(false);

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = await getToken();
    if (!token && !demoMode) throw new Error("登录凭证不可用；请重新登录后再访问团队 Notes 服务。");
    return fetch(path, { ...init, headers: { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  }, [getToken]);

  const load = useCallback(async () => {
    if (demoMode) {
      setLoading(false);
      setUnavailable(false);
      setNotes((current) => current.length ? current : demoNotes);
      return;
    }
    if (!realReadEnabled) {
      setLoading(false);
      setUnavailable(true);
      setMessage("共享 Notes 的读取与写入尚未在生产环境开放。当前页面不会向任何服务发送文件或笔记内容。");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const payload = await responseJson(await request("/api/shared-notes", { cache: "no-store" })) as { notes: Note[]; configured?: boolean; ingestionFrozen?: boolean };
      setNotes(payload.notes || []);
      setConfigured(Boolean(payload.configured));
      setIngestionFrozen(payload.ingestionFrozen !== false);
      setUnavailable(false);
      setSelected((current) => current ? (payload.notes || []).find((item) => item.id === current.id) || null : null);
    } catch (error) {
      setUnavailable(true);
      setMessage(error instanceof Error ? error.message : "共享 Notes 服务暂时不可用。");
    } finally { setLoading(false); }
  }, [request]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const resetComposer = () => {
    setSelected(null); setTitle(""); setBody(""); setSourceKind("manual_note"); setSensitivityLevel("internal"); setAiProcessingAllowed(false); setExternalSearchAllowed(false); setDownloadAllowed(false); setAttachments([]); setQueuedFile(null); setWriteConfirmation(""); setPreviewAttachmentId(null); setEditingBody(false); setPreviewState("ready"); setMessage("");
  };
  const choose = async (note: Note) => {
    setAttachments([]); setQueuedFile(null); setWriteConfirmation(""); setPreviewAttachmentId(null); setEditingBody(false); setPreviewState("ready");
    if (demoMode) {
      setSelected(note); setTitle(note.title); setBody(note.body || ""); setSourceKind(note.sourceKind || "manual_note");
      setSensitivityLevel(note.sensitivityLevel); setAiProcessingAllowed(note.aiProcessingAllowed); setExternalSearchAllowed(note.externalSearchAllowed); setDownloadAllowed(note.downloadAllowed);
      return;
    }
    if (!realReadEnabled) return;
    setSaving(true); setMessage("");
    try {
      const payload = await responseJson(await request(`/api/shared-notes/${note.id}`, { cache: "no-store" })) as { note: Note };
      const full = payload.note;
      setSelected(full); setTitle(full.title); setBody(full.body || ""); setSourceKind(full.sourceKind || "manual_note");
      setSensitivityLevel(full.sensitivityLevel); setAiProcessingAllowed(full.aiProcessingAllowed); setExternalSearchAllowed(full.externalSearchAllowed); setDownloadAllowed(full.downloadAllowed);
      const attachmentPayload = await responseJson(await request(`/api/shared-notes/${full.id}/attachments`, { cache: "no-store" })) as { attachments?: Attachment[] };
      setAttachments(attachmentPayload.attachments || []);
    } catch (error) { setMessage(error instanceof Error ? error.message : "无法打开 Note。"); }
    finally { setSaving(false); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) { setMessage("请先填写标题。"); return; }
    if (demoMode) {
      const now = new Date().toISOString();
      const next: Note = selected
        ? { ...selected, title: title.trim(), body, sourceKind, sensitivityLevel, aiProcessingAllowed, externalSearchAllowed, downloadAllowed, version: selected.version + 1, updatedAt: now }
        : { id: `demo-note-${now}`, title: title.trim(), body, sourceKind, sensitivityLevel, aiProcessingAllowed, externalSearchAllowed, downloadAllowed, version: 1, createdAt: now, updatedAt: now, owner: { display_name: "Demo user" } };
      setNotes((current) => selected ? current.map((item) => item.id === selected.id ? next : item) : [next, ...current]);
      setSelected(next); setPreviewState("success"); setWriteConfirmation(""); setMessage(queuedFile ? "本地演示记录已更新；附件没有上传，刷新页面后记录和文件都会消失。" : "本地演示记录已更新；刷新页面即还原，没有发送到团队服务。");
      return;
    }
    if (!sharedWriteEnabled || !configured || ingestionFrozen) {
      setMessage("共享写入尚未开放：保存按钮不会发送任何内容。请等待团队数据库、对象存储与审计服务完成配置。");
      return;
    }
    setSaving(true); setMessage("");
    try {
      const endpoint = selected ? `/api/shared-notes/${selected.id}` : "/api/shared-notes";
      const payload = await responseJson(await request(endpoint, {
        method: selected ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected?.id, expectedVersion: selected?.version ?? 0, title, body, sourceKind, sensitivityLevel, aiProcessingAllowed, externalSearchAllowed, downloadAllowed }),
      })) as { note: Note };
      const refreshed = await responseJson(await request("/api/shared-notes", { cache: "no-store" })) as { notes?: Note[] };
      const confirmed = (refreshed.notes || []).find((note) => note.id === payload.note?.id);
      if (!confirmed) throw new Error("团队 Notes 写入未能在刷新后确认；已停止后续附件上传。");
      setNotes(refreshed.notes || []); setSelected(confirmed);
      setMessage(selected ? "团队 Notes 已更新并已在共享列表确认。" : "团队 Notes 已创建并已在共享列表确认。");
      setWriteConfirmation(`团队写入已确认 · Note ID: ${confirmed.id} · v${confirmed.version}`);
      if (queuedFile) await uploadAttachment(confirmed.id, queuedFile);
    } catch (error) { setMessage(error instanceof Error ? error.message : "保存失败。"); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!selected || !window.confirm(`将“${selected.title}”移入已删除状态？`)) return;
    if (demoMode) {
      setNotes((current) => current.filter((note) => note.id !== selected.id));
      resetComposer(); setPreviewState("success"); setMessage("演示删除完成：只改变本地内存，未写入团队服务。");
      return;
    }
    if (!sharedWriteEnabled || !configured || ingestionFrozen) {
      setMessage("共享写入尚未开放：不会删除任何团队记录。");
      return;
    }
    setSaving(true); setMessage("");
    try {
      await responseJson(await request(`/api/shared-notes/${selected.id}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, expectedVersion: selected.version }),
      }));
      resetComposer(); await load(); setMessage("已删除；原记录保留在共享数据库的审计历史中。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "删除失败。"); }
    finally { setSaving(false); }
  };
  const loadAttachments = async (noteId: string) => {
    const payload = await responseJson(await request(`/api/shared-notes/${noteId}/attachments`, { cache: "no-store" })) as { attachments?: Attachment[] };
    setAttachments(payload.attachments || []);
    return payload.attachments || [];
  };
  const openAttachment = async (attachment: Attachment) => {
    if (!selected || demoMode) { setPreviewAttachmentId(attachment.id); return attachment; }
    try {
      const payload = await responseJson(await request(`/api/shared-notes/${selected.id}/attachments/${attachment.id}`, { cache: "no-store" })) as { attachment: Attachment };
      const detail = payload.attachment;
      setAttachments((current) => current.map((item) => item.id === detail.id ? { ...item, ...detail } : item));
      setPreviewAttachmentId(detail.id);
      return detail;
    } catch (error) { setMessage(error instanceof Error ? error.message : "无法读取附件预览。"); return attachment; }
  };
  const uploadAttachment = async (noteId: string, file: File) => {
    setPreviewState("uploading"); setMessage("正在初始化附件并取得 COS 直传凭证…");
    try {
      const hash = await sha256(file);
      const init = await responseJson(await request(`/api/shared-notes/${noteId}/attachments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, mediaType: file.type, byteSize: file.size, sha256: hash }) })) as { attachment: Attachment; upload?: { url?: string; method?: string; headers?: Record<string, string> } };
      setAttachments((current) => [init.attachment, ...current.filter((item) => item.id !== init.attachment.id)]);
      if (!init.upload?.url) throw new Error("附件直传尚不可用；服务没有返回 COS 上传地址。");
      const direct = await fetch(init.upload.url, { method: init.upload.method || "PUT", headers: init.upload.headers || {}, body: file });
      if (!direct.ok) throw new Error(`COS 直传失败（${direct.status}）。`);
      setPreviewState("processing"); setMessage("文件已直传 COS，后台正在解析…");
      const completed = await responseJson(await request(`/api/shared-notes/${noteId}/attachments/${init.attachment.id}/complete`, { method: "POST" })) as { attachment: Attachment };
      const attachment = completed.attachment;
      setAttachments((current) => [attachment, ...current.filter((item) => item.id !== attachment.id)]);
      setQueuedFile(null);
      setWriteConfirmation((current) => `${current || `团队写入已确认 · Note ID: ${noteId}`} · 附件 ID: ${attachment.id}`);
      const detailed = await openAttachment(attachment);
      if (detailed.extraction?.text) { setPreviewState("partial"); setMessage(`${attachment.fileName} 已解析，可在右侧只读预览；如需写入 Note 正文，请进入编辑模式。`); }
      else if (attachment.parseStatus === "needs_review" && attachment.parseErrorCode === "PARSING_DEFERRED") { setPreviewState("success"); setMessage(`${attachment.fileName} 已保存；正文解析将在后台任务上线后开放。`); }
      else if (attachment.parseStatus === "needs_review") { setPreviewState("ocr_required"); setMessage(`${attachment.fileName} 需要 OCR 或人工审核，未写入正文。`); }
      else if (attachment.parseStatus === "failed") { setPreviewState("error"); setMessage(`${attachment.fileName} 解析失败，可重试。`); }
      else { setPreviewState("processing"); setMessage(`${attachment.fileName} 已提交解析；可刷新附件状态。`); }
      return attachment;
    } catch (error) { const detail = error instanceof Error ? error.message : "附件上传失败。"; setPreviewState("error"); setMessage(detail); throw error; }
  };
  const retryAttachment = async (attachment: Attachment) => {
    try { setPreviewState("processing"); setMessage(`正在重试解析 ${attachment.fileName}…`); const payload = await responseJson(await request(`/api/shared-notes/${selected?.id}/attachments/${attachment.id}/retry`, { method: "POST" })) as { attachment: Attachment }; setAttachments((current) => [payload.attachment, ...current.filter((item) => item.id !== attachment.id)]); await loadAttachments(selected!.id); setMessage("已重新提交解析。"); }
    catch (error) { setPreviewState("error"); setMessage(error instanceof Error ? error.message : "重试失败。"); }
  };
  const deleteAttachment = async (attachment: Attachment) => {
    if (!selected || !window.confirm(`将附件“${attachment.fileName}”移入已删除状态？`)) return;
    try { await responseJson(await request(`/api/shared-notes/${selected.id}/attachments/${attachment.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: attachment.version }) })); setAttachments((current) => current.filter((item) => item.id !== attachment.id)); setMessage("附件已软删除，审计记录仍保留。"); }
    catch (error) { setPreviewState("error"); setMessage(error instanceof Error ? error.message : "删除附件失败。"); }
  };
  const importDocument = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setQueuedFile(file);
    if (demoMode) { setPreviewState("ready"); setMessage("当前为本地演示：文件已选择但不会上传，也不会进入解析。请切换到团队写入环境后再上传。 "); }
    else if (selected?.id) void uploadAttachment(selected.id, file);
    else { setPreviewState("ready"); setMessage("文件已选择并暂存于当前浏览器；先保存 Note 以创建记录后会自动上传。刷新页面前请完成保存。"); }
  };
  const filtered = notes.filter((note) => `${note.title} ${note.sourceKind}`.toLowerCase().includes(query.trim().toLowerCase()));
  const previewAttachment = attachments.find((attachment) => attachment.id === previewAttachmentId) || attachments[0] || null;

  const writeOpen = demoMode || (sharedWriteEnabled && configured && !ingestionFrozen);
  const stateCopy: Record<PreviewState, { title: string; detail: string }> = {
    ready: { title: "", detail: "" },
    loading: { title: "Notes 正在加载", detail: "正在读取已发布的共享记录。" },
    empty: { title: "还没有 Notes", detail: "目前没有符合筛选条件的记录。" },
    error: { title: "Notes 暂时无法读取", detail: "请稍后重试；不会将空白页面伪装成没有数据。" },
    uploading: { title: "文件正在上传", detail: "原文件正发送到受鉴权的后台解析服务。" },
    processing: { title: "后台正在解析", detail: "浏览器不会本地解析文件；等待解析服务完成。" },
    partial: { title: "解析完成，等待审核", detail: "文字预览已从后台返回；保存前请确认内容。" },
    ocr_required: { title: "需要 OCR", detail: "该文件未返回可检索文字，尚未写入正文。" },
    failed: { title: "解析未完成", detail: "文件没有写入共享库。请检查格式或稍后重试。" },
    conflict: { title: "版本冲突", detail: "另一位成员已更新这条记录。请加载最新版后再决定是否合并。" },
    success: { title: "演示操作完成", detail: "仅改变本地演示内存；没有写入团队数据。" },
  };

  return <section className="shared-notes-workspace">
    <header className="shared-notes-header shared-notes-toolbar" aria-label="Notes 操作">
      <div className="shared-notes-actions">
        <span className={demoMode ? "demo-pill" : "coming-pill"}>{demoMode ? "本地演示模式 · 不会上传或写入团队" : !realReadEnabled ? "团队 Notes API 未启用" : !sharedWriteEnabled ? "团队写入开关未启用" : "团队写入待确认"}</span>
        {demoMode && <label className="research-preview-control">预览状态<select value={previewState} onChange={(event) => setPreviewState(event.target.value as PreviewState)}>{Object.entries({ loading: "加载中", empty: "空状态", error: "错误", uploading: "上传中", processing: "后台解析中", partial: "部分完成", ocr_required: "需要 OCR", failed: "解析失败", conflict: "版本冲突", success: "成功", ready: "正常" }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
        <button className="quiet-button" onClick={() => void load()} disabled={loading || (!demoMode && !realReadEnabled)}>{loading ? "刷新中…" : "刷新"}</button><button onClick={resetComposer} disabled={!writeOpen}>＋ 新建 Note</button>
      </div>
    </header>
    <p className="research-preview-boundary">{demoMode ? "当前是本地演示：选择文件、保存 Note 都不会发送到 API、COS 或团队数据库。" : "附件先由后端初始化，再由浏览器直传 COS，最后由后台解析。新建 Note 会先保存主体再上传暂存附件；任何失败都会明确显示，不会伪装成功。"}</p>
    {previewState !== "ready" && <div className={`research-preview-state state-${previewState}`} role="status"><strong>{stateCopy[previewState].title}</strong><span>{stateCopy[previewState].detail}</span></div>}
    {unavailable ? <div className="shared-notes-unavailable"><strong>共享 Notes 暂不可用</strong><p>{message}</p><button className="quiet-button" onClick={() => void load()}>重试</button></div> : <div className="shared-notes-layout">
      <aside className="shared-notes-list"><input aria-label="检索 Notes" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="检索标题或正文" />
        <div className="shared-notes-count">{loading ? "加载中…" : `${filtered.length} 条共享 Notes`}</div>
        {!loading && !filtered.length && <p className="shared-notes-empty">还没有团队 Notes。</p>}
        {filtered.map((note) => <button key={note.id} className={`shared-note-row ${selected?.id === note.id ? "selected" : ""}`} onClick={() => void choose(note)}><strong>{note.title}</strong><span>{note.owner?.display_name || note.owner?.email || "团队成员"} · {new Date(note.updatedAt).toLocaleDateString("zh-CN")}</span><small>{note.sourceKind} · {note.sensitivityLevel}</small></button>)}
      </aside>
      <form className="shared-notes-editor" onSubmit={save}>
        <div className="shared-notes-editor-head"><div><p className="eyebrow">{selected ? "EDIT SHARED NOTE" : "NEW SHARED NOTE"}</p><h3>{selected ? "编辑共享 Note" : "新增共享 Note"}</h3></div>{selected && <span>v{selected.version}</span>}</div>
        <div className="editor-metadata-grid notes-metadata-grid">
          <label className="metadata-title"><span>标题</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={240} placeholder="例如：NVDA management meeting · key takeaways" /></label>
          <label><span>来源类型</span><select value={sourceKind} onChange={(event) => setSourceKind(event.target.value)}><option value="manual_note">手动 Note</option><option value="meeting_note">会议纪要</option><option value="weekly_note">周度跟踪</option><option value="uploaded_pdf">PDF 文档</option><option value="uploaded_docx">DOCX 文档</option><option value="uploaded_text">上传文本</option></select></label>
          <label><span>敏感级别</span><select value={sensitivityLevel} onChange={(event) => setSensitivityLevel(event.target.value as Note["sensitivityLevel"])}><option value="public">公开</option><option value="internal">内部</option><option value="confidential">机密</option><option value="restricted">受限</option></select></label>
        </div>
        <fieldset className="shared-notes-flags"><legend>使用权限</legend><label><input type="checkbox" checked={aiProcessingAllowed} onChange={(event) => setAiProcessingAllowed(event.target.checked)} />允许团队 AI 处理</label><label><input type="checkbox" checked={externalSearchAllowed} onChange={(event) => setExternalSearchAllowed(event.target.checked)} />允许外部联网检索</label><label><input type="checkbox" checked={downloadAllowed} onChange={(event) => setDownloadAllowed(event.target.checked)} />允许下载</label></fieldset>
        <input ref={fileInput} type="file" accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" hidden onChange={(event) => void importDocument(event)} />
        <div className="notes-content-grid">
          <section className="notes-file-panel" aria-label="上传与文件状态">
            <div><p className="eyebrow">BACKEND PARSING</p><h4>文件解析</h4></div>
            <p>{attachments.length ? `${attachments.length} 个附件` : queuedFile ? demoMode ? "已选择（不会上传）" : "已选择，待保存后上传" : "尚未选择文件"}</p>
            {attachments.length ? <div className="attachment-list">{attachments.map((attachment) => <div className={`notes-file-details ${previewAttachment?.id === attachment.id ? "selected" : ""}`} key={attachment.id}><button type="button" className="attachment-preview-select" onClick={() => void openAttachment(attachment)}><strong title={attachment.fileName}>{attachment.fileName}</strong><span>{(attachment.mediaType || "document").toUpperCase()} · {(attachment.byteSize / 1024 / 1024).toFixed(2)} MB</span><span>{attachmentLabel(attachment)} · v{attachment.version}</span></button>{attachment.extraction?.warnings?.map((warning) => <small key={warning}>{warning}</small>)}{attachment.parseErrorCode && <small>{attachment.parseErrorCode}</small>}<div className="attachment-actions">{attachment.parseStatus === "failed" && <button type="button" className="quiet-button" onClick={() => void retryAttachment(attachment)}>重试</button>}<button type="button" className="quiet-button" onClick={() => void deleteAttachment(attachment)}>删除</button></div></div>)}</div> : <small>支持 PDF、DOCX、TXT、Markdown，单文件不超过 25 MB。扫描版 PDF 会标记为需要 OCR。</small>}
            <small className="local-only-note">文件字节不经过前端 API：浏览器仅凭短时 COS 地址直传，正文只来自 complete 的解析结果。</small>
            <div className="attachment-actions"><button type="button" className="quiet-button" disabled={!writeOpen} onClick={() => fileInput.current?.click()}>{attachments.length || queuedFile ? "添加附件" : "选择文件"}</button>{queuedFile && selected && <button type="button" className="quiet-button" disabled={!writeOpen} onClick={() => void uploadAttachment(selected.id, queuedFile)}>重试上传</button>}</div>
          </section>
          <section className="shared-notes-body document-preview-panel" aria-label="正文预览"><div className="document-preview-head"><span>正文预览</span><button type="button" className="quiet-button" onClick={() => setEditingBody((current) => !current)}>{editingBody ? "完成编辑" : "编辑正文"}</button></div>{editingBody ? <label className="document-edit-field"><span>可编辑 Note 正文</span><textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={500000} placeholder="输入可供团队检索的正文。" /></label> : !previewAttachment ? <div className="document-preview-empty"><strong>尚未选择文件</strong><p>上传或选择一个附件后，可在这里查看只读文件预览。</p></div> : documentKind(previewAttachment) === "pdf" && safePreviewUrl(previewAttachment.previewUrl) ? <iframe className="document-pdf-preview" title={`${previewAttachment.fileName} PDF 预览`} src={safePreviewUrl(previewAttachment.previewUrl)!} sandbox="allow-scripts allow-same-origin" /> : <div className="document-preview-content"><div className="document-preview-file-meta"><strong>{previewAttachment.fileName}</strong><span>{documentKind(previewAttachment) === "docx" ? "DOCX · 后端已解析正文" : `${documentKind(previewAttachment).toUpperCase()} · 只读文本预览`}</span></div>{previewAttachment.extraction?.text ? <ReadonlyTextPreview text={previewAttachment.extraction.text} markdown={documentKind(previewAttachment) === "md"} /> : <div className="document-preview-empty"><strong>{attachmentLabel(previewAttachment)}</strong><p>{documentKind(previewAttachment) === "pdf" ? "尚未取得可安全内嵌的 PDF 地址；解析后的正文就绪后会显示在此处。" : "后端尚未返回可预览的正文。请稍后刷新或重试解析。"}</p></div>}</div>}</section>
        </div>
        <div className="shared-notes-editor-actions"><button type="submit" disabled={saving || !writeOpen}>{saving ? "保存中…" : demoMode ? "仅保存到本地演示" : "保存到团队 Notes"}</button>{selected && <button type="button" className="danger-button" disabled={saving || !writeOpen} onClick={() => void remove()}>删除</button>}</div>
        {writeConfirmation && <p className="shared-write-confirmation" role="status">{writeConfirmation}</p>}
        {message && <p className="shared-notes-message">{message}</p>}
      </form>
    </div>}
  </section>;
}
