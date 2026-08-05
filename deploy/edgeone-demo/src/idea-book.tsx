import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { ContributionStrip } from "./contribution-strip";
import { MarketValidation } from "../../../app/market-validation";

type IdeaStatus = "draft" | "pending_review" | "approved" | "rejected" | "archived";
type IdeaDirection = "long" | "short" | "watch";
type Idea = {
  id: string;
  title: string;
  ticker?: string;
  owner?: { display_name?: string; email?: string };
  status: IdeaStatus;
  direction: IdeaDirection;
  thesis?: string;
  templateFields?: Record<string, string>;
  sensitivityLevel?: "public" | "internal" | "confidential" | "restricted";
  viewAllowed?: boolean;
  internalAiAllowed?: boolean;
  externalAiAllowed?: boolean;
  webSearchAllowed?: boolean;
  downloadAllowed?: boolean;
  redactionRequired?: boolean;
  noteIds?: string[];
  noteTitles?: string[];
  version: number;
  createdAt?: string;
  updatedAt: string;
};
type LinkedNote = { id: string; title: string };
type IdeaAttachment = {
  id: string;
  fileName: string;
  mediaType?: string;
  byteSize: number;
  uploadStatus: "initialized" | "uploaded" | "failed";
  parseStatus: "queued" | "processing" | "ready" | "partial" | "needs_review" | "failed";
  parseErrorCode?: string;
  version: number;
  extraction?: { status?: string; pageCount?: number; paragraphCount?: number; warnings?: string[]; text?: string };
};
type PreviewState = "ready" | "loading" | "empty" | "error" | "uploading" | "processing" | "partial" | "ocr_required" | "failed" | "conflict" | "success";

const demoMode = import.meta.env.VITE_UI_FIXTURES === "true";
const realReadEnabled = import.meta.env.VITE_SHARED_IDEAS_READ_ENABLED !== "false";
const sharedWriteEnabled = import.meta.env.VITE_SHARED_IDEAS_WRITE_ENABLED !== "false";

const fixtures: Idea[] = [
  { id: "demo-idea-idc", title: "China IDC pricing recovery", ticker: "VNET", owner: { display_name: "Demo PM" }, status: "pending_review", direction: "long", thesis: "Synthetic example: test whether supply discipline and signed contract pricing support a durable earnings inflection.", noteIds: ["demo-note-idc-pricing"], noteTitles: ["AI data centre pricing · meeting notes"], version: 3, createdAt: "2026-08-03T02:00:00.000Z", updatedAt: "2026-08-03T02:00:00.000Z" },
  { id: "demo-idea-ads", title: "Internet advertising inflection", ticker: "META", owner: { display_name: "Demo Analyst" }, status: "draft", direction: "watch", thesis: "Synthetic example: separate cyclical demand recovery from share gain before submitting for review.", noteIds: ["demo-note-consumer-tracker"], noteTitles: ["Consumer internet weekly tracker"], version: 1, createdAt: "2026-08-02T09:00:00.000Z", updatedAt: "2026-08-02T09:00:00.000Z" },
];

const demoNotes: LinkedNote[] = [
  { id: "demo-note-idc-pricing", title: "AI data centre pricing · meeting notes" },
  { id: "demo-note-consumer-tracker", title: "Consumer internet weekly tracker" },
];

const statuses: Record<IdeaStatus, string> = { draft: "草稿", pending_review: "待审核", approved: "已批准", rejected: "未通过", archived: "已归档" };
const directions: Record<IdeaDirection, string> = { long: "看多", short: "看空", watch: "观察" };

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Ideas库服务暂时不可用。");
  return payload;
}

async function sha256(file: File) { const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer()); return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join(""); }
function attachmentLabel(attachment: IdeaAttachment) { if (attachment.parseErrorCode === "PARSING_DEFERRED") return "已上传 · 解析待上线"; if (attachment.parseStatus === "needs_review") return "需要人工审核 / OCR"; if (attachment.parseStatus === "failed" || attachment.uploadStatus === "failed") return "解析失败"; if (attachment.parseStatus === "ready" || attachment.parseStatus === "partial") return "解析完成"; if (attachment.uploadStatus === "initialized") return "等待直传"; return "后台解析中"; }

export function IdeaBookView() {
  const { getToken } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [ideas, setIdeas] = useState<Idea[]>(() => demoMode ? fixtures : []);
  const [notes, setNotes] = useState<LinkedNote[]>(() => demoMode ? demoNotes : []);
  const [selected, setSelected] = useState<Idea | null>(demoMode ? fixtures[0] : null);
  const [title, setTitle] = useState(demoMode ? fixtures[0].title : "");
  const [ticker, setTicker] = useState(demoMode ? fixtures[0].ticker || "" : "");
  const [thesis, setThesis] = useState(demoMode ? fixtures[0].thesis || "" : "");
  const [status, setStatus] = useState<IdeaStatus>(demoMode ? fixtures[0].status : "draft");
  const [direction, setDirection] = useState<IdeaDirection>(demoMode ? fixtures[0].direction : "watch");
  const [noteIds, setNoteIds] = useState<string[]>(demoMode ? fixtures[0].noteIds || [] : []);
  const [sensitivityLevel, setSensitivityLevel] = useState<Idea["sensitivityLevel"]>("internal");
  const [viewAllowed, setViewAllowed] = useState(true);
  const [internalAiAllowed, setInternalAiAllowed] = useState(false);
  const [externalAiAllowed, setExternalAiAllowed] = useState(false);
  const [webSearchAllowed, setWebSearchAllowed] = useState(false);
  const [downloadAllowed, setDownloadAllowed] = useState(false);
  const [redactionRequired, setRedactionRequired] = useState(false);
  const [templateFields, setTemplateFields] = useState<Record<string, string>>({ marketCap: "", fwdPe: "", analyst: "", businessIndustryOverview: "", consensusGap: "", financialForecast: "", valuation: "", catalysts: "", pmFollowUp: "", validationStatus: "unreviewed", trackingStatus: "not_tracking", fundamentalValidationStatus: "unreviewed", fundamentalValidationNotes: "", validationNextCheck: "", upsideTargetPct: "", downsideRiskPct: "" });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(demoMode || realReadEnabled);
  const [configured, setConfigured] = useState(false);
  const [ingestionFrozen, setIngestionFrozen] = useState(true);
  const [message, setMessage] = useState("");
  const [previewState, setPreviewState] = useState<PreviewState>("ready");
  const [attachments, setAttachments] = useState<IdeaAttachment[]>([]);
  const [queuedFile, setQueuedFile] = useState<File | null>(null);
  const [writeConfirmation, setWriteConfirmation] = useState("");

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = await getToken();
    if (!token && !demoMode) throw new Error("登录凭证不可用；请重新登录后再访问团队 Ideas库服务。");
    return fetch(path, { ...init, headers: { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  }, [getToken]);

  const load = useCallback(async () => {
    if (demoMode) { setLoading(false); setIdeas((current) => current.length ? current : fixtures); setNotes((current) => current.length ? current : demoNotes); return; }
    if (!realReadEnabled) { setLoading(false); setMessage("共享 Ideas库的读取与写入尚未在生产环境开放。当前页面不会发送任何 Idea 内容。"); return; }
    setLoading(true);
    try {
      const [ideaPayload, notePayload] = await Promise.all([
        readJson(await request("/api/shared-ideas", { cache: "no-store" })) as Promise<{ ideas?: Idea[]; configured?: boolean; ingestionFrozen?: boolean }>,
        readJson(await request("/api/shared-notes", { cache: "no-store" })) as Promise<{ notes?: LinkedNote[] }>,
      ]);
      setIdeas(ideaPayload.ideas || []); setNotes(notePayload.notes || []); setConfigured(Boolean(ideaPayload.configured)); setIngestionFrozen(ideaPayload.ingestionFrozen !== false);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ideas库服务暂时不可用。"); setPreviewState("error"); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => { const task = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(task); }, [load]);

  const filtered = useMemo(() => ideas.filter((idea) => `${idea.title} ${idea.ticker || ""} ${idea.thesis || ""} ${idea.owner?.display_name || ""}`.toLowerCase().includes(query.trim().toLowerCase())), [ideas, query]);
  const writeOpen = demoMode || (sharedWriteEnabled && configured && !ingestionFrozen);
  const populateIdea = (idea: Idea) => { setSelected(idea); setTitle(idea.title); setTicker(idea.ticker || ""); setThesis(idea.thesis || ""); setStatus(idea.status); setDirection(idea.direction || "watch"); setNoteIds(idea.noteIds || []); setSensitivityLevel(idea.sensitivityLevel || "internal"); setViewAllowed(idea.viewAllowed !== false); setInternalAiAllowed(idea.internalAiAllowed === true); setExternalAiAllowed(idea.externalAiAllowed === true); setWebSearchAllowed(idea.webSearchAllowed === true); setDownloadAllowed(idea.downloadAllowed === true); setRedactionRequired(idea.redactionRequired === true); setTemplateFields(idea.templateFields || {}); setAttachments([]); setQueuedFile(null); setWriteConfirmation(""); setMessage(""); };
  const selectIdea = async (idea: Idea) => {
    if (demoMode) { populateIdea(idea); return; }
    try {
      const payload = await readJson(await request(`/api/shared-ideas/${idea.id}`, { cache: "no-store" })) as { idea: Idea };
      populateIdea(payload.idea);
      const attachmentPayload = await readJson(await request(`/api/shared-ideas/${payload.idea.id}/attachments`, { cache: "no-store" })) as { attachments?: IdeaAttachment[] };
      setAttachments(attachmentPayload.attachments || []);
    } catch (error) { setMessage(error instanceof Error ? error.message : "无法打开 Idea。"); setPreviewState("error"); }
  };
  const newIdea = () => { setSelected(null); setTitle(""); setTicker(""); setThesis(""); setStatus("draft"); setDirection("watch"); setNoteIds([]); setSensitivityLevel("internal"); setViewAllowed(true); setInternalAiAllowed(false); setExternalAiAllowed(false); setWebSearchAllowed(false); setDownloadAllowed(false); setRedactionRequired(false); setTemplateFields({ marketCap: "", fwdPe: "", analyst: "", businessIndustryOverview: "", consensusGap: "", financialForecast: "", valuation: "", catalysts: "", pmFollowUp: "", validationStatus: "unreviewed", trackingStatus: "not_tracking", fundamentalValidationStatus: "unreviewed", fundamentalValidationNotes: "", validationNextCheck: "", upsideTargetPct: "", downsideRiskPct: "" }); setAttachments([]); setQueuedFile(null); setWriteConfirmation(""); setMessage(""); setPreviewState("ready"); };
  const save = async () => {
    if (!title.trim()) { setMessage("请先填写 Idea 标题。"); return; }
    if (demoMode) {
      const now = new Date().toISOString();
      const next: Idea = selected
        ? { ...selected, title: title.trim(), ticker: ticker.trim(), thesis, status, direction, noteIds, templateFields, sensitivityLevel, viewAllowed, internalAiAllowed, externalAiAllowed, webSearchAllowed, downloadAllowed, redactionRequired, noteTitles: notes.filter((note) => noteIds.includes(note.id)).map((note) => note.title), version: selected.version + 1, updatedAt: now }
        : { id: `demo-idea-${now}`, title: title.trim(), ticker: ticker.trim(), thesis, status, direction, noteIds, templateFields, sensitivityLevel, viewAllowed, internalAiAllowed, externalAiAllowed, webSearchAllowed, downloadAllowed, redactionRequired, noteTitles: notes.filter((note) => noteIds.includes(note.id)).map((note) => note.title), owner: { display_name: "Demo user" }, version: 1, updatedAt: now };
      setIdeas((current) => selected ? current.map((idea) => idea.id === selected.id ? next : idea) : [next, ...current]); setSelected(next); setPreviewState("success"); setMessage("演示操作完成：只写入本地内存，刷新页面即恢复；没有保存到团队数据。"); return;
    }
    if (!writeOpen) { setMessage("尚未开放上传：共享数据库、对象存储或写入队列未配置完成，不会发送或保存这条 Idea。"); return; }
    try {
      const endpoint = selected ? `/api/shared-ideas/${selected.id}` : "/api/shared-ideas";
      const payload = await readJson(await request(endpoint, { method: selected ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected?.id, expectedVersion: selected?.version || 0, title, ticker, thesis, status, direction, noteIds, templateFields, sensitivityLevel, viewAllowed, internalAiAllowed, externalAiAllowed, webSearchAllowed, downloadAllowed, redactionRequired }) })) as { idea: Idea };
      const refreshed = await readJson(await request("/api/shared-ideas", { cache: "no-store" })) as { ideas?: Idea[] };
      const confirmed = (refreshed.ideas || []).find((idea) => idea.id === payload.idea?.id);
      if (!confirmed) throw new Error("团队 Idea 写入未能在刷新后确认；已停止后续附件上传。");
      setIdeas(refreshed.ideas || []); setSelected(confirmed); setWriteConfirmation(`团队写入已确认 · Idea ID: ${confirmed.id} · v${confirmed.version}`); setMessage("已保存并已在共享 Ideas库列表确认。"); if (queuedFile) await uploadAttachment(confirmed.id, queuedFile);
    } catch (error) { const text = error instanceof Error ? error.message : "保存失败"; setMessage(text); setPreviewState(/conflict|版本/i.test(text) ? "conflict" : "error"); }
  };
  const loadAttachments = async (ideaId: string) => { const payload = await readJson(await request(`/api/shared-ideas/${ideaId}/attachments`, { cache: "no-store" })) as { attachments?: IdeaAttachment[] }; setAttachments(payload.attachments || []); return payload.attachments || []; };
  const uploadAttachment = async (ideaId: string, file: File) => {
    setPreviewState("uploading"); setMessage("正在初始化附件并取得 COS 直传凭证…");
    try {
      const init = await readJson(await request(`/api/shared-ideas/${ideaId}/attachments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, mediaType: file.type, byteSize: file.size, sha256: await sha256(file) }) })) as { attachment: IdeaAttachment; upload?: { url?: string; method?: string; headers?: Record<string, string> } };
      setAttachments((current) => [init.attachment, ...current.filter((item) => item.id !== init.attachment.id)]);
      if (!init.upload?.url) throw new Error("附件直传尚不可用；服务没有返回 COS 上传地址。");
      const direct = await fetch(init.upload.url, { method: init.upload.method || "PUT", headers: init.upload.headers || {}, body: file }); if (!direct.ok) throw new Error(`COS 直传失败（${direct.status}）。`);
      setPreviewState("processing"); setMessage("附件已直传 COS，后台正在解析…");
      const completed = await readJson(await request(`/api/shared-ideas/${ideaId}/attachments/${init.attachment.id}/complete`, { method: "POST" })) as { attachment: IdeaAttachment };
      const attachment = completed.attachment; setAttachments((current) => [attachment, ...current.filter((item) => item.id !== attachment.id)]); setQueuedFile(null);
      if (attachment.extraction?.text) { setPreviewState("partial"); setMessage(`${attachment.fileName} 已解析，可替换或补充核心判断。`); }
      else if (attachment.parseStatus === "needs_review" && attachment.parseErrorCode === "PARSING_DEFERRED") { setPreviewState("success"); setMessage(`${attachment.fileName} 已保存；正文解析将在后台任务上线后开放。`); }
      else if (attachment.parseStatus === "needs_review") { setPreviewState("ocr_required"); setMessage(`${attachment.fileName} 需要 OCR 或人工审核。`); }
      else if (attachment.parseStatus === "failed") { setPreviewState("error"); setMessage(`${attachment.fileName} 解析失败，可重试。`); }
      else { setPreviewState("processing"); setMessage(`${attachment.fileName} 已提交解析；可刷新状态。`); }
    } catch (error) { setPreviewState("error"); setMessage(error instanceof Error ? error.message : "附件上传失败。"); throw error; }
  };
  const chooseAttachment = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; setQueuedFile(file); if (selected?.id) void uploadAttachment(selected.id, file); else setMessage("附件已暂存于当前浏览器；先保存 Idea 后会自动上传。刷新页面前请完成保存。"); };
  const retryAttachment = async (attachment: IdeaAttachment) => { if (!selected) return; try { setPreviewState("processing"); const payload = await readJson(await request(`/api/shared-ideas/${selected.id}/attachments/${attachment.id}/retry`, { method: "POST" })) as { attachment: IdeaAttachment }; setAttachments((current) => [payload.attachment, ...current.filter((item) => item.id !== attachment.id)]); await loadAttachments(selected.id); setMessage("已重新提交解析。"); } catch (error) { setPreviewState("error"); setMessage(error instanceof Error ? error.message : "重试失败。"); } };
  const deleteAttachment = async (attachment: IdeaAttachment) => { if (!selected || !window.confirm(`将附件“${attachment.fileName}”移入已删除状态？`)) return; try { await readJson(await request(`/api/shared-ideas/${selected.id}/attachments/${attachment.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: attachment.version }) })); setAttachments((current) => current.filter((item) => item.id !== attachment.id)); setMessage("附件已软删除，审计记录仍保留。"); } catch (error) { setPreviewState("error"); setMessage(error instanceof Error ? error.message : "删除附件失败。"); } };
  const replaceThesisFromAttachment = (attachment: IdeaAttachment) => { if (!attachment.extraction?.text) return; setThesis(attachment.extraction.text); setMessage("已用解析内容替换核心判断；请审核后再保存 Idea。"); };
  const appendThesisFromAttachment = (attachment: IdeaAttachment) => { if (!attachment.extraction?.text) return; setThesis((current) => current ? `${current}\n\n${attachment.extraction?.text}` : attachment.extraction?.text || ""); setMessage("已将解析内容补充到核心判断；请审核后再保存 Idea。"); };
  const remove = async () => {
    if (!selected || !window.confirm(`将“${selected.title}”移入已删除状态？`)) return;
    if (demoMode) { setIdeas((current) => current.filter((idea) => idea.id !== selected.id)); newIdea(); setPreviewState("success"); setMessage("演示删除完成：只改变本地内存，未写入团队数据。"); return; }
    if (!writeOpen) { setMessage("共享写入尚未开放：不会删除任何团队 Idea。"); return; }
    try { await readJson(await request(`/api/shared-ideas/${selected.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, expectedVersion: selected.version }) })); newIdea(); await load(); setMessage("已软删除；原记录保留在审计历史中。"); }
    catch (error) { const text = error instanceof Error ? error.message : "删除失败"; setMessage(text); setPreviewState(/conflict|版本/i.test(text) ? "conflict" : "error"); }
  };

  const stateCopy: Record<PreviewState, { title: string; detail: string }> = {
    ready: { title: "", detail: "" }, loading: { title: "Ideas库正在加载", detail: "正在读取已发布的共享 Ideas。" }, empty: { title: "还没有 Ideas", detail: "目前没有符合筛选条件的记录。" }, error: { title: "Ideas库暂时无法读取", detail: "请稍后重试；不会将空白页面伪装成没有数据。" }, uploading: { title: "附件正在上传", detail: "原文件正发送到受鉴权的后台解析服务。" }, processing: { title: "后台正在解析", detail: "浏览器不会本地解析附件；等待解析服务完成。" }, partial: { title: "附件已解析，等待审核", detail: "可将解析内容写入或补充到核心判断。" }, ocr_required: { title: "需要 OCR", detail: "附件未返回可检索文字，尚未写入核心判断。" }, failed: { title: "处理未完成", detail: "没有写入共享库。请检查输入后重试。" }, conflict: { title: "版本冲突", detail: "另一位成员已更新此 Idea。请读取最新版本后再合并修改。" }, success: { title: "演示操作完成", detail: "仅在本地演示内存中变更；没有写入团队数据。" },
  };

  return <section className="idea-book-workspace shared-notes-workspace">
    <ContributionStrip />
    <header className="shared-notes-header shared-notes-toolbar" aria-label="Ideas库操作"><div className="shared-notes-actions"><span className={demoMode ? "demo-pill" : "coming-pill"}>{demoMode ? "公开/合成演示数据 · 不会保存" : !realReadEnabled ? "团队 Idea API 未启用" : !sharedWriteEnabled ? "团队写入开关未启用" : !configured || ingestionFrozen ? "团队存储或上传服务未就绪" : "团队共享已连接"}</span>{demoMode && <label className="research-preview-control">预览状态<select value={previewState} onChange={(event) => setPreviewState(event.target.value as PreviewState)}>{Object.entries({ loading: "加载中", empty: "空状态", error: "错误", uploading: "上传中", processing: "后台解析中", partial: "部分完成", ocr_required: "需要 OCR", failed: "失败", conflict: "版本冲突", success: "成功", ready: "正常" }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}<button className="quiet-button" onClick={() => void load()} disabled={loading || (!demoMode && !realReadEnabled)}>{loading ? "刷新中…" : "刷新"}</button><button type="button" onClick={newIdea} disabled={!writeOpen}>＋ 新建投资备忘录</button></div></header>
    <p className="research-preview-boundary">附件先由后端初始化，再由浏览器直传 COS，最后由后台解析。新建 Idea 会先保存主体再上传暂存附件；任何失败都会明确显示，不会伪装成功。</p>
    {previewState !== "ready" && <div className={`research-preview-state state-${previewState}`} role="status"><strong>{stateCopy[previewState].title}</strong><span>{stateCopy[previewState].detail}</span></div>}
    <div className="shared-notes-layout">
      <aside className="shared-notes-list"><input aria-label="检索 Ideas库" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="检索 Idea、Ticker 或负责人" /><div className="shared-notes-count">{loading ? "加载中…" : `${filtered.length} 条投资备忘录`}</div>{!loading && !filtered.length && <p className="shared-notes-empty">没有匹配的投资备忘录。</p>}{filtered.map((idea) => <button type="button" key={idea.id} className={`shared-note-row ${selected?.id === idea.id ? "selected" : ""}`} onClick={() => void selectIdea(idea)}><strong>{idea.title}</strong><span>{idea.ticker || "未标注 ticker"} · {idea.owner?.display_name || idea.owner?.email || "团队成员"}</span><small className={`idea-status status-${idea.status}`}>{directions[idea.direction || "watch"]} · {statuses[idea.status]} · v{idea.version}</small></button>)}</aside>
      <div className="shared-notes-editor">
        <div className="shared-notes-editor-head"><div><p className="eyebrow">INVESTMENT MEMO</p><h3>{selected ? selected.title : "新增投资备忘录"}</h3></div>{selected && <span>v{selected.version}</span>}</div>
        <div className="editor-metadata-grid idea-metadata-grid">
          <label className="metadata-title"><span>标的名称 / Memo 标题</span><input value={title} onChange={(event) => setTitle(event.target.value)} disabled={!writeOpen} placeholder="例如：Company（TICKER）— Initiation" /></label>
          <label><span>Ticker / Yahoo Symbol</span><input value={ticker} onChange={(event) => setTicker(event.target.value)} disabled={!writeOpen} placeholder="例如：AMZN / 9988 HK / 300308 CH" /></label>
          <label><span>Market Cap</span><input value={templateFields.marketCap || ""} onChange={(event) => setTemplateFields((current) => ({ ...current, marketCap: event.target.value }))} disabled={!writeOpen} placeholder="US$ bn" /></label>
          <label><span>Fwd P/E (NTM)</span><input value={templateFields.fwdPe || ""} onChange={(event) => setTemplateFields((current) => ({ ...current, fwdPe: event.target.value }))} disabled={!writeOpen} placeholder="x" /></label>
          <label><span>Analyst</span><input value={templateFields.analyst || ""} onChange={(event) => setTemplateFields((current) => ({ ...current, analyst: event.target.value }))} disabled={!writeOpen} placeholder="Name" /></label>
          <label><span>方向</span><select value={direction} onChange={(event) => setDirection(event.target.value as IdeaDirection)} disabled={!writeOpen}>{Object.entries(directions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>审核状态</span><select value={status} onChange={(event) => setStatus(event.target.value as IdeaStatus)} disabled={!writeOpen}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>数据分级</span><select value={sensitivityLevel} onChange={(event) => setSensitivityLevel(event.target.value as Idea["sensitivityLevel"])} disabled={!writeOpen}><option value="public">Public · 公开</option><option value="internal">Internal · 内部</option><option value="confidential">Confidential · 机密</option><option value="restricted">Restricted · 严格受限</option></select></label>
        </div>
        <div className="idea-content-grid">
          <label className="shared-notes-body"><span>2. Investment Thesis</span><textarea value={thesis} onChange={(event) => setThesis(event.target.value)} disabled={!writeOpen} placeholder="2–4 个可证伪、与可量化驱动相连的判断。" /></label>
          <fieldset className="shared-notes-flags idea-note-links"><legend>关联 Notes</legend>{notes.map((note) => <label key={note.id}><input type="checkbox" checked={noteIds.includes(note.id)} disabled={!writeOpen} onChange={(event) => setNoteIds((current) => event.target.checked ? [...current, note.id] : current.filter((id) => id !== note.id))} />{note.title}</label>)}</fieldset>
        </div>
        <div className="editor-metadata-grid idea-metadata-grid"><label><span>1. Business & Industry Overview</span><textarea value={templateFields.businessIndustryOverview || ""} onChange={(event) => setTemplateFields((current) => ({ ...current, businessIndustryOverview: event.target.value }))} disabled={!writeOpen} /></label><label><span>3. Our Case vs. Consensus Expectations</span><textarea value={templateFields.consensusGap || ""} onChange={(event) => setTemplateFields((current) => ({ ...current, consensusGap: event.target.value }))} disabled={!writeOpen} /></label><label><span>4. Financial Forecast</span><textarea value={templateFields.financialForecast || ""} onChange={(event) => setTemplateFields((current) => ({ ...current, financialForecast: event.target.value }))} disabled={!writeOpen} /></label><label><span>5. Historical Valuation</span><textarea value={templateFields.valuation || ""} onChange={(event) => setTemplateFields((current) => ({ ...current, valuation: event.target.value }))} disabled={!writeOpen} /></label><label><span>Upcoming Catalysts</span><textarea value={templateFields.catalysts || ""} onChange={(event) => setTemplateFields((current) => ({ ...current, catalysts: event.target.value }))} disabled={!writeOpen} /></label><label><span>PM Follow-up</span><textarea value={templateFields.pmFollowUp || ""} onChange={(event) => setTemplateFields((current) => ({ ...current, pmFollowUp: event.target.value }))} disabled={!writeOpen} placeholder="PM 的追问、下一步验证或反馈" /></label><label><span>Validation</span><select value={templateFields.validationStatus || "unreviewed"} onChange={(event) => setTemplateFields((current) => ({ ...current, validationStatus: event.target.value }))} disabled={!writeOpen}><option value="unreviewed">未验证</option><option value="supporting">证据支持</option><option value="mixed">证据分化</option><option value="challenged">证据反向</option></select></label><label><span>Tracking</span><select value={templateFields.trackingStatus || "not_tracking"} onChange={(event) => setTemplateFields((current) => ({ ...current, trackingStatus: event.target.value }))} disabled={!writeOpen}><option value="not_tracking">未进入跟踪</option><option value="tracking">持续跟踪</option><option value="paused">暂停跟踪</option><option value="closed">已结束</option></select></label></div>
        <section className="fundamental-validation-card">
          <header><div><p className="eyebrow">FUNDAMENTAL VALIDATION</p><h4>基本面验证</h4></div><span>由 analyst / PM 持续更新</span></header>
          <div className="fundamental-validation-grid">
            <label><span>验证状态</span><select value={templateFields.fundamentalValidationStatus || "unreviewed"} onChange={(event) => setTemplateFields((current) => ({ ...current, fundamentalValidationStatus: event.target.value }))} disabled={!writeOpen}><option value="unreviewed">未验证</option><option value="supporting">基本面支持</option><option value="mixed">证据分化</option><option value="challenged">基本面反向</option></select></label>
            <label><span>预期 Upside</span><input value={templateFields.upsideTargetPct || ""} onChange={(event) => setTemplateFields((current) => ({ ...current, upsideTargetPct: event.target.value }))} disabled={!writeOpen} placeholder="例如：+25%" /></label>
            <label><span>Downside Risk</span><input value={templateFields.downsideRiskPct || ""} onChange={(event) => setTemplateFields((current) => ({ ...current, downsideRiskPct: event.target.value }))} disabled={!writeOpen} placeholder="例如：-15%" /></label>
            <label className="fundamental-validation-notes"><span>基本面证据 / 反向证据</span><textarea value={templateFields.fundamentalValidationNotes || ""} onChange={(event) => setTemplateFields((current) => ({ ...current, fundamentalValidationNotes: event.target.value }))} disabled={!writeOpen} placeholder="记录财报、订单、渠道、管理层口径及证伪条件；可在后续 tracking 中继续编辑。" /></label>
            <label className="fundamental-validation-next"><span>下一观察点</span><input value={templateFields.validationNextCheck || ""} onChange={(event) => setTemplateFields((current) => ({ ...current, validationNextCheck: event.target.value }))} disabled={!writeOpen} placeholder="下一次财报 / 数据点 / 日期" /></label>
          </div>
        </section>
        <MarketValidation ticker={ticker} startedAt={selected?.createdAt || selected?.updatedAt} label="Idea 股价验证" />
        <input ref={fileInput} type="file" accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" hidden onChange={chooseAttachment} />
        <section className="idea-attachment-panel" aria-label="Idea 附件上传与解析"><div><p className="eyebrow">ATTACHMENT PARSING</p><h4>附件</h4></div><p>{attachments.length ? `${attachments.length} 个附件` : queuedFile ? "待保存后上传" : "可上传支撑材料"}</p>{attachments.length ? <div className="attachment-list">{attachments.map((attachment) => <div className="notes-file-details" key={attachment.id}><strong title={attachment.fileName}>{attachment.fileName}</strong><span>{(attachment.mediaType || "document").toUpperCase()} · {(attachment.byteSize / 1024 / 1024).toFixed(2)} MB</span><span>{attachmentLabel(attachment)} · v{attachment.version}</span>{attachment.extraction?.warnings?.map((warning) => <small key={warning}>{warning}</small>)}{attachment.parseErrorCode && <small>{attachment.parseErrorCode}</small>}<div className="attachment-actions">{attachment.parseStatus === "failed" && <button type="button" className="quiet-button" disabled={!writeOpen} onClick={() => void retryAttachment(attachment)}>重试</button>}<button type="button" className="quiet-button" disabled={!writeOpen} onClick={() => void deleteAttachment(attachment)}>删除</button>{attachment.extraction?.text && <><button type="button" className="quiet-button" disabled={!writeOpen} onClick={() => replaceThesisFromAttachment(attachment)}>替换判断</button><button type="button" className="quiet-button" disabled={!writeOpen} onClick={() => appendThesisFromAttachment(attachment)}>补充判断</button></>}</div></div>)}</div> : <small>支持 PDF、DOCX、TXT、Markdown；先由后台解析，再决定如何用于 Idea。</small>}<div className="attachment-actions"><button type="button" className="quiet-button" disabled={!writeOpen} onClick={() => fileInput.current?.click()}>选择附件</button>{queuedFile && selected && <button type="button" className="quiet-button" disabled={!writeOpen} onClick={() => void uploadAttachment(selected.id, queuedFile)}>重试上传</button>}</div></section>
        <div className="shared-notes-editor-actions">{demoMode && <button type="button" className="quiet-button" onClick={() => setPreviewState("conflict")}>模拟版本冲突</button>}<button type="button" disabled={!writeOpen || !title.trim()} onClick={() => void save()}>保存 Idea</button>{selected && <button type="button" className="danger-button" disabled={!writeOpen} onClick={() => void remove()}>删除</button>}</div>
        {selected && <p className="research-preview-import">当前 v{selected.version} · {new Date(selected.updatedAt).toLocaleString("zh-CN")} · 关联 {selected.noteIds?.length || 0} 条 Notes。</p>}{writeConfirmation && <p className="shared-write-confirmation" role="status">{writeConfirmation}</p>}{message && <p className="shared-notes-message">{message}</p>}
      </div>
    </div>
  </section>;
}
