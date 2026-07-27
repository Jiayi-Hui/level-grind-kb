"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Language } from "./i18n";
import { exportUpdatedWorkbook, parseModelWorkbook, type ParsedModelVariable } from "./xlsx-model";
import simpleModelDemoUrl from "./assets/Simple_Valuation_Model_Demo.xlsx?url";

type ModelSummary = {
  id: string;
  model_name: string;
  company: string;
  ticker: string;
  sector: string;
  owner_name: string;
  owner_email: string;
  version: string;
  status: string;
  file_name: string;
  file_size: number;
  source_notes: string;
  updated_at: string;
  stale_count: number;
  pending_count: number;
};

type ModelVariable = {
  id: string;
  model_id: string;
  variable_key: string;
  label: string;
  kind: "input" | "calculation" | "output";
  sheet_name: string;
  cell_ref: string;
  value: string;
  formula: string;
  unit: string;
  period: string;
  source_system: string;
  source_url: string;
  source_date?: string;
  is_stale: number;
};

type ModelUpdate = {
  id: string;
  variable_id: string;
  variable_key: string;
  label: string;
  unit: string;
  source_type: string;
  source_label: string;
  source_date?: string;
  proposed_value: string;
  status: string;
};

type Change = {
  id: string;
  actor_email: string;
  action: string;
  summary: string;
  created_at: string;
};

type Payload = {
  models: ModelSummary[];
  selected?: ModelSummary;
  variables: ModelVariable[];
  updates: ModelUpdate[];
  changes: Change[];
};

export function ModelWorkbench({
  language,
  authorizedFetch,
  onError,
  onToast,
}: {
  language: Language;
  authorizedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  onError: (message: string) => void;
  onToast: (message: string) => void;
}) {
  const [payload, setPayload] = useState<Payload>({ models: [], variables: [], updates: [], changes: [] });
  const [selectedId, setSelectedId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [parsedVariables, setParsedVariables] = useState<ParsedModelVariable[]>([]);
  const [templateCompatible, setTemplateCompatible] = useState(false);
  const [recognitionMode, setRecognitionMode] = useState<"standard" | "financial-model" | "archive-only">("archive-only");
  const [primaryTab, setPrimaryTab] = useState<"upload" | "registry">("upload");
  const [tab, setTab] = useState<"inputs" | "logic" | "updates" | "history">("inputs");
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [selectedFileName, setSelectedFileName] = useState("");

  async function load(id = selectedId) {
    const response = await authorizedFetch(`/api/models${id ? `?id=${encodeURIComponent(id)}` : ""}`);
    const next = await response.json() as Payload & { error?: string };
    if (!response.ok) throw new Error(next.error || "Could not load model workbench.");
    setPayload(next);
    setSelectedId(next.selected?.id || next.models[0]?.id || "");
    setDraftValues(Object.fromEntries(next.variables.map((variable) => [variable.id, variable.value])));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load().catch((error) => onError(error.message)), 0);
    return () => window.clearTimeout(timer);
    // Initial fetch only; model selection calls load directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = payload.selected;
  const inputs = useMemo(() => payload.variables.filter((item) => item.kind === "input"), [payload.variables]);
  const calculations = useMemo(() => payload.variables.filter((item) => item.kind !== "input"), [payload.variables]);
  const pending = useMemo(() => payload.updates.filter((item) => item.status === "pending"), [payload.updates]);

  async function chooseFile(file?: File) {
    setParsedVariables([]);
    setTemplateCompatible(false);
    setRecognitionMode("archive-only");
    setSelectedFileName(file?.name || "");
    if (!file) return;
    try {
      const parsed = await parseModelWorkbook(file);
      setParsedVariables(parsed.variables);
      setTemplateCompatible(parsed.templateCompatible);
      setRecognitionMode(parsed.recognitionMode);
    } catch {
      onError(language === "zh"
        ? "无法读取该工作簿。仍可上传保存，但在线变量编辑需要使用标准模板。"
        : "The workbook could not be mapped. It can still be stored, but online variable editing requires the standard template.");
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setUploading(true);
    onError("");
    try {
      const form = new FormData(formElement);
      form.set("variablesJson", JSON.stringify(parsedVariables));
      const response = await authorizedFetch("/api/models", { method: "POST", body: form });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error || "Upload failed.");
      formElement.reset();
      setParsedVariables([]);
      setTemplateCompatible(false);
      setRecognitionMode("archive-only");
      setSelectedFileName("");
      await load(result.id);
      setPrimaryTab("registry");
      onToast(language === "zh" ? "模型已进入线上目录" : "Model added to the online registry");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function updateVariable(variable: ModelVariable) {
    const value = draftValues[variable.id] ?? variable.value;
    const response = await authorizedFetch("/api/models", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update-variable", modelId: variable.model_id, variableId: variable.id, value }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "Update failed.");
    await load(variable.model_id);
    onToast(language === "zh" ? "输入已保存并记入修改记录" : "Input saved and logged");
  }

  async function scanUpdates() {
    if (!selected) return;
    const response = await authorizedFetch("/api/models", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "scan-updates", modelId: selected.id }),
    });
    const result = await response.json() as { queued?: number; error?: string };
    if (!response.ok) throw new Error(result.error || "Scan failed.");
    await load(selected.id);
    onToast(language === "zh" ? `已生成 ${result.queued || 0} 条待审核线索` : `${result.queued || 0} review items created`);
  }

  async function acceptUpdate(update: ModelUpdate) {
    if (!selected) return;
    const value = window.prompt(
      language === "zh" ? `审核 ${update.label} 的新值` : `Review a new value for ${update.label}`,
      update.proposed_value || "",
    );
    if (value === null || !value.trim()) return;
    const response = await authorizedFetch("/api/models", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept-update", modelId: selected.id, updateId: update.id, value }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "Approval failed.");
    await load(selected.id);
    onToast(language === "zh" ? "变量已更新并通过审核" : "Variable updated and approved");
  }

  async function exportWorkbook() {
    if (!selected) return;
    try {
      const response = await authorizedFetch(`/api/models/files/${selected.id}`);
      if (!response.ok) throw new Error("Download failed.");
      const updated = await exportUpdatedWorkbook(await response.arrayBuffer(), payload.variables);
      const exportedBuffer = new Uint8Array(updated).buffer as ArrayBuffer;
      const url = URL.createObjectURL(new Blob([exportedBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = selected.file_name.replace(/\.xlsx$/i, `-${selected.version}-updated.xlsx`);
      anchor.click();
      URL.revokeObjectURL(url);
      onToast(language === "zh" ? "已导出更新后的 Excel；打开时会自动重算公式" : "Updated workbook exported; formulas recalculate when opened");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Export failed.");
    }
  }

  return (
    <section className="model-board">
      <nav className="model-primary-tabs" aria-label={language === "zh" ? "模型工作台" : "Model workbench"}>
        <button className={primaryTab === "upload" ? "active" : ""} onClick={() => setPrimaryTab("upload")}>
          ↑ {language === "zh" ? "上传 Excel" : "Upload Excel"}
        </button>
        <button className={primaryTab === "registry" ? "active" : ""} onClick={() => setPrimaryTab("registry")}>
          {language === "zh" ? "模型目录" : "Model registry"} <span>{payload.models.length}</span>
        </button>
      </nav>

      {primaryTab === "upload" && <section className="model-upload-panel">
        <header>
          <div><p className="eyebrow">AI-ASSISTED WORKBOOK MAPPING</p><h2>{language === "zh" ? "上传现有 Excel 模型" : "Upload an existing Excel model"}</h2><p>{language === "zh" ? "系统会识别假设、历史数据、计算和估值输出；识别结果由 analyst 审核后再写回。" : "The system maps assumptions, historical data, calculations, and valuation outputs for analyst review."}</p></div>
          <a className="quiet-button" href={simpleModelDemoUrl} download="Simple_Valuation_Model_Demo.xlsx">↓ {language === "zh" ? "下载简单示例" : "Download simple demo"}</a>
        </header>
        <form className="model-upload" onSubmit={upload}>
          <input name="modelName" placeholder={language === "zh" ? "模型名称" : "Model name"} required />
          <input name="company" placeholder={language === "zh" ? "公司" : "Company"} required />
          <input name="ticker" placeholder={language === "zh" ? "股票代码" : "Ticker"} />
          <input name="sector" placeholder={language === "zh" ? "行业" : "Sector"} />
          <input name="ownerName" placeholder={language === "zh" ? "负责人" : "Owner"} />
          <input name="version" placeholder="v1.0" defaultValue="v1.0" />
          <input name="sourceNotes" placeholder={language === "zh" ? "主要数据来源" : "Primary sources"} />
          <label className="model-file">
            <span>{selectedFileName || (language === "zh" ? "选择 .xlsx" : "Choose .xlsx")}</span>
            <input name="file" type="file" accept=".xlsx" required onChange={(event) => void chooseFile(event.target.files?.[0])} />
          </label>
          <button className="upload-button" disabled={uploading}>{uploading ? (language === "zh" ? "上传中…" : "Uploading…") : (language === "zh" ? "识别并加入目录" : "Map & add model")}</button>
          {selectedFileName && (
            <small className={templateCompatible ? "mapping-ok" : "mapping-note"}>
              {templateCompatible
                ? (language === "zh"
                  ? `已识别 ${parsedVariables.length} 个变量 · ${recognitionMode === "financial-model" ? "通用财务模型" : "标准模板"}`
                  : `${parsedVariables.length} variables mapped · ${recognitionMode === "financial-model" ? "financial model" : "standard template"}`)
                : (language === "zh" ? "未找到可编辑变量；仍可作为原始模型归档" : "No editable variables found; the original can still be archived")}
            </small>
          )}
        </form>
      </section>}

      {primaryTab === "registry" && <div className="model-layout">
        <aside className="model-list">
          <div className="section-title"><h2>{language === "zh" ? "模型目录" : "Model registry"}</h2><span>{payload.models.length}</span></div>
          {payload.models.map((model) => (
            <button
              key={model.id}
              className={model.id === selectedId ? "model-row active" : "model-row"}
              onClick={() => void load(model.id).catch((error) => onError(error.message))}
            >
              <strong>{model.company}</strong><span>{model.version}</span>
              <small>{model.model_name} · {model.owner_name || model.owner_email}</small>
              {(model.stale_count > 0 || model.pending_count > 0) && <em>{model.stale_count || model.pending_count}</em>}
            </button>
          ))}
          {!payload.models.length && <div className="empty-state compact"><p>{language === "zh" ? "上传第一个 Excel 模型开始。" : "Upload the first Excel model to begin."}</p></div>}
        </aside>

        <div className="model-detail">
          {!selected ? <div className="empty-state"><h3>{language === "zh" ? "还没有模型" : "No model selected"}</h3></div> : (
            <>
              <header className="model-detail-head">
                <div><span>{selected.ticker || selected.sector || "MODEL"}</span><h2>{selected.company} · {selected.model_name}</h2><p>{selected.owner_name || selected.owner_email} · {selected.version} · {new Date(selected.updated_at).toLocaleString(language === "zh" ? "zh-CN" : "en")}</p></div>
                <div><button className="quiet-button" onClick={() => void scanUpdates().catch((error) => onError(error.message))}>{language === "zh" ? "扫描年报与事件" : "Scan reports & events"}</button><button className="upload-button" onClick={() => void exportWorkbook()}>{language === "zh" ? "导出 Excel" : "Export Excel"}</button></div>
              </header>
              <nav className="model-tabs">
                {([
                  ["inputs", language === "zh" ? "输入" : "Inputs", inputs.length],
                  ["logic", language === "zh" ? "计算与输出" : "Logic & outputs", calculations.length],
                  ["updates", language === "zh" ? "待更新" : "Pending", pending.length],
                  ["history", language === "zh" ? "修改记录" : "History", payload.changes.length],
                ] as const).map(([id, label, count]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}<span>{count}</span></button>)}
              </nav>
              <div className="model-tab-content">
                {tab === "inputs" && <div className="variable-table">
                  <div className="variable-row header"><span>{language === "zh" ? "变量" : "Variable"}</span><span>{language === "zh" ? "数值" : "Value"}</span><span>{language === "zh" ? "期间 / 来源" : "Period / source"}</span><span /></div>
                  {inputs.map((variable) => <div className="variable-row" key={variable.id}>
                    <span><strong>{variable.label}</strong><small>{variable.variable_key} · {variable.cell_ref}</small></span>
                    <label><input value={draftValues[variable.id] ?? variable.value} onChange={(event) => setDraftValues((current) => ({ ...current, [variable.id]: event.target.value }))} /><small>{variable.unit}</small></label>
                    <span><strong>{variable.period || "—"}</strong><small>{variable.source_system || (language === "zh" ? "未标注来源" : "No source")}</small></span>
                    <button className="quiet-button" onClick={() => void updateVariable(variable).catch((error) => onError(error.message))}>{language === "zh" ? "保存" : "Save"}</button>
                  </div>)}
                  {!inputs.length && <div className="empty-state compact"><p>{language === "zh" ? "该文件尚未映射到标准 Inputs 表。" : "This workbook has not been mapped to the standard Inputs sheet."}</p></div>}
                </div>}
                {tab === "logic" && <div className="variable-table">
                  {calculations.map((variable) => <div className="variable-row logic" key={variable.id}><span><strong>{variable.label}</strong><small>{variable.kind} · {variable.sheet_name}!{variable.cell_ref}</small></span><code>{variable.formula ? `=${variable.formula}` : variable.value}</code><span><strong>{variable.value || "—"} {variable.unit}</strong><small>{variable.period}</small></span></div>)}
                  {!calculations.length && <div className="empty-state compact"><p>{language === "zh" ? "上传标准模板后显示计算和输出映射。" : "Upload the standard template to map calculations and outputs."}</p></div>}
                </div>}
                {tab === "updates" && <div className="update-queue">
                  {pending.map((update) => <article key={update.id}><div><span>{update.source_type}</span><h3>{update.label}</h3><p>{update.source_label}</p><small>{update.source_date || (language === "zh" ? "日期待核对" : "Date not supplied")}</small></div><button className="quiet-button" onClick={() => void acceptUpdate(update).catch((error) => onError(error.message))}>{language === "zh" ? "审核并写回" : "Review & apply"}</button></article>)}
                  {!pending.length && <div className="empty-state compact"><p>{language === "zh" ? "没有待审核变量。扫描最新年报和事件以生成线索。" : "No pending variables. Scan recent reports and events to generate review items."}</p></div>}
                </div>}
                {tab === "history" && <div className="change-log">{payload.changes.map((change) => <article key={change.id}><span>{change.action.replaceAll("_", " ")}</span><strong>{change.summary}</strong><small>{change.actor_email} · {new Date(change.created_at).toLocaleString(language === "zh" ? "zh-CN" : "en")}</small></article>)}</div>}
              </div>
            </>
          )}
        </div>
      </div>}
    </section>
  );
}
