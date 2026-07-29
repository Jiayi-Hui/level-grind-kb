"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Language } from "./i18n";

type Freshness = "current" | "aging" | "stale" | "unknown";
type Confidence = "high" | "medium" | "low" | "unknown";
type ProjectStatus = "operational" | "construction" | "unknown";
type OwnerMetric = "currentItMw" | "currentH100e" | "estimatedCapitalCostUsdBn";
type ProjectMetric = "itMw" | "h100e" | "estimatedCapitalCostUsdBn";

type SourceRecord = {
  id: string;
  publisher: string;
  title: string;
  sourceType: string;
  sourceDate: string | null;
  observationDate: string | null;
  accessedAt: string;
  urlOrAssetId: string;
  rightsStatus: string;
  verificationStatus: string;
};

type TimelinePoint = {
  date: string;
  quarter: string;
  period: "historical-current" | "epoch-baseline-plan";
  constructionStatus: string | null;
  buildingsOperational: number | null;
  itMw: number | null;
  totalPowerMw: number | null;
  h100e: number | null;
  estimatedCapitalCostUsdBn: number | null;
  sourceIds: string[];
};

type ChipQuantity = {
  date: string;
  chipType: string;
  units: number | null;
  chipTypeEvidence: string | null;
  unitsEvidence: string | null;
  notes: string | null;
  sourceIds: string[];
};

type CapexProject = {
  id: string;
  name: string;
  owner: string;
  users: string[];
  country: string;
  address: string | null;
  currentItMw: number | null;
  currentH100e: number | null;
  estimatedCapitalCostUsdBn: number | null;
  currentChipTypes: string[];
  status: ProjectStatus;
  statusBasis: string;
  confidence: Confidence;
  confidenceBasis: string;
  observationDate: string | null;
  observationAgeDays: number | null;
  freshness: Freshness;
  latestMilestone: string | null;
  calculationSheetUrl: string | null;
  sourceIds: string[];
  timeline: TimelinePoint[];
  chipQuantities: ChipQuantity[];
};

type OwnerCapacity = {
  owner: string;
  campuses: number;
  currentItMw: number;
  currentH100e: number;
  estimatedCapitalCostUsdBn: number;
  sourceIds: string[];
};

type CapacityQuarter = {
  quarter: string;
  periodEnd: string;
  historicalItMw: number | null;
  epochBaselinePlannedItMw: number | null;
  status: "historical-current" | "epoch-baseline-plan";
  observationDate: string;
  sourceIds: string[];
};

type StatusCapacity = {
  status: ProjectStatus;
  campuses: number;
  currentItMw: number;
  sourceIds: string[];
};

type CapexPayload = {
  schemaVersion: string;
  generatedAt: string;
  syncedAtHkt: string;
  dataCutoff: string;
  modelVersion: string;
  reviewStatus: string;
  baselineLabel: string;
  recordCounts: {
    campuses: number;
    timelineRecords: number;
    siteChipDateRecords: number;
    hardwareRecords: number;
    sources: number;
    reviewedForecasts: number;
  };
  knownLimitations: string[];
  freshnessMethod: {
    basis: string;
    currentDays: string;
    agingDays: string;
    staleDays: string;
    unknown: string;
  };
  metricMethods: Record<string, string>;
  kpis: {
    campuses: number;
    currentItMw: number;
    currentH100e: number;
    estimatedCapitalCostUsdBn: number;
    observationDate: string | null;
    sourceIds: string[];
  };
  owners: OwnerCapacity[];
  capacityTimeline: CapacityQuarter[];
  statusPipeline: StatusCapacity[];
  projects: CapexProject[];
  sources: SourceRecord[];
  reviewedForecasts: unknown[];
};

type TooltipRow = {
  name?: string;
  dataKey?: string;
  value?: number | string;
  color?: string;
  payload?: {
    status?: string;
    sourceIds?: string[];
    observationDate?: string;
    periodEnd?: string;
  };
};

const statusColors: Record<ProjectStatus, string> = {
  operational: "#2f6b54",
  construction: "#4f78a6",
  unknown: "#929a95",
};

const freshnessOrder: Freshness[] = ["current", "aging", "stale", "unknown"];

function date(value?: string | null) {
  return value || "—";
}

function compactNumber(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en", {
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: digits,
  }).format(value);
}

function metricValue(value: number | null, metric: OwnerMetric | ProjectMetric) {
  if (metric === "currentItMw" || metric === "itMw") return `${compactNumber(value)} MW`;
  if (metric === "currentH100e" || metric === "h100e") return `${compactNumber(value, 1)} H100e`;
  return `$${compactNumber(value, 2)}bn`;
}

function sourceNumber(id: string) {
  return Number(id.replace(/\D/g, "")) || id;
}

function SourceLinks({ ids }: { ids: string[] }) {
  return (
    <span className="aidc-source-links">
      {[...new Set(ids)].map((id) => (
        <a key={id} href={`#aidc-source-${id}`} aria-label={`Open source ${sourceNumber(id)}`}>
          [{sourceNumber(id)}]
        </a>
      ))}
    </span>
  );
}

function EvidenceLine({
  ids,
  observationDate,
  payload,
  method,
}: {
  ids: string[];
  observationDate: string | null;
  payload: CapexPayload;
  method: string;
}) {
  return (
    <footer className="aidc-evidence-line">
      <span>Source / 来源 <SourceLinks ids={ids} /></span>
      <span>Observation date · {date(observationDate)}</span>
      <span>Data cutoff · {payload.dataCutoff}</span>
      <span>Synced · {payload.syncedAtHkt}</span>
      <span>Method / 口径 · {method}</span>
    </footer>
  );
}

function ResearchTooltip({
  active,
  payload,
  label,
  metric,
  language,
}: {
  active?: boolean;
  payload?: readonly TooltipRow[];
  label?: string | number;
  metric: OwnerMetric | ProjectMetric | "campuses" | "units";
  language: Language;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="aidc-tooltip">
      <strong>{label}</strong>
      {payload.filter((item) => item.value !== null && item.value !== undefined).map((item) => (
        <span key={item.dataKey || item.name} style={{ color: item.color }}>
          {item.name} · {metric === "campuses"
            ? `${compactNumber(Number(item.value), 0)} ${language === "zh" ? "个园区" : "campuses"}`
            : metric === "units"
              ? `${compactNumber(Number(item.value), 0)} ${language === "zh" ? "颗" : "units"}`
            : metricValue(Number(item.value), metric)}
        </span>
      ))}
      <small>{language === "zh" ? "状态" : "Status"} · {row?.status || "Epoch baseline"}</small>
      <small>{language === "zh" ? "来源" : "Sources"} · {(row?.sourceIds || []).map((id) => `[${sourceNumber(id)}]`).join(" ")}</small>
      <small>Observation date · {row?.observationDate || row?.periodEnd || "—"}</small>
    </div>
  );
}

function labels(language: Language) {
  return language === "zh" ? {
    baseline: "Baseline：Epoch AI 估算",
    cutoff: "数据截至",
    synced: "Level Grind 同步",
    campuses: "覆盖园区数",
    itMw: "当前 IT MW",
    h100e: "当前 H100-equivalent",
    cost: "当前估算资本成本",
    ownerTitle: "业主容量对比",
    ownerNote: "按当前 Epoch AI 园区快照聚合；颜色表示运营基线，不表示置信度。",
    buildoutTitle: "建设容量时间线",
    buildoutNote: "历史/当前使用实线；未来仅展示 Epoch baseline 规划，暂无审核后的 p10/p50/p90。",
    history: "历史 / 当前",
    planned: "Epoch baseline 规划",
    pipelineTitle: "园区状态基线",
    pipelineNote: "仅区分已有当前容量与仍在建设观察中的园区；不推断延期或暂停概率。",
    projectMatrix: "项目矩阵",
    projectCount: "个匹配园区",
    owner: "业主",
    country: "国家",
    status: "状态",
    confidence: "置信度",
    freshness: "数据新鲜度",
    all: "全部",
    project: "项目",
    location: "国家和地址",
    chips: "芯片类型",
    observation: "最后观察日期",
    openProject: "打开项目",
    reset: "清除筛选",
    noProjects: "没有匹配项目",
    noProjectsBody: "减少筛选条件后再查看项目和来源。",
    detail: "项目详情",
    metricHistory: "功率、算力与成本变化",
    chipHistory: "芯片数量变化",
    milestones: "重要里程碑",
    calculation: "计算口径",
    calculationOpen: "打开 Epoch 计算表",
    sources: "Sources & Freshness",
    sourceId: "编号",
    publisher: "发布者",
    title: "具体标题",
    sourceType: "来源类型",
    sourceDate: "来源发布日期",
    observationDate: "数据观察日期",
    accessedDate: "访问日期",
    url: "URL / Asset ID",
    rights: "权利状态",
    verification: "验证状态",
    pilot: "Research pilot / 尚待研究",
    pilotBody: "暂无审核后的 building-level 状态、延期概率、未来四季度 MW 或公司 Capex Momentum。页面不会用假数据补齐。",
    retry: "重新加载",
    loading: "正在载入 AI Capex 研究快照…",
    partial: "部分数据",
  } : {
    baseline: "Baseline: Epoch AI estimates",
    cutoff: "Data cutoff",
    synced: "Level Grind synced",
    campuses: "Campuses tracked",
    itMw: "Current IT MW",
    h100e: "Current H100-equivalent",
    cost: "Estimated capital cost",
    ownerTitle: "Owner capacity comparison",
    ownerNote: "Aggregated from the current Epoch AI campus snapshot; color indicates operating baseline, not confidence.",
    buildoutTitle: "Buildout capacity timeline",
    buildoutNote: "Historical/current is solid; future points are Epoch baseline plans. No reviewed p10/p50/p90 exists yet.",
    history: "Historical / current",
    planned: "Epoch baseline plan",
    pipelineTitle: "Campus status baseline",
    pipelineNote: "Separates campuses with current capacity from observed construction only; no delay or pause probability is inferred.",
    projectMatrix: "Project matrix",
    projectCount: "matching campuses",
    owner: "Owner",
    country: "Country",
    status: "Status",
    confidence: "Confidence",
    freshness: "Freshness",
    all: "All",
    project: "Project",
    location: "Country and address",
    chips: "Chip type",
    observation: "Last observation",
    openProject: "Open project",
    reset: "Clear filters",
    noProjects: "No matching projects",
    noProjectsBody: "Reduce the filters to inspect projects and sources.",
    detail: "Project detail",
    metricHistory: "Power, compute, and cost progression",
    chipHistory: "Chip quantity history",
    milestones: "Material milestones",
    calculation: "Calculation method",
    calculationOpen: "Open Epoch calculation sheet",
    sources: "Sources & Freshness",
    sourceId: "ID",
    publisher: "Publisher",
    title: "Exact title",
    sourceType: "Source type",
    sourceDate: "Source date",
    observationDate: "Observation date",
    accessedDate: "Accessed",
    url: "URL / Asset ID",
    rights: "Rights",
    verification: "Verification",
    pilot: "Research pilot / pending research",
    pilotBody: "No reviewed building-level status, delay probability, next-four-quarter MW, or company Capex Momentum exists. The UI does not fill these gaps with synthetic data.",
    retry: "Reload",
    loading: "Loading the AI Capex research snapshot…",
    partial: "Partial data",
  };
}

function statusLabel(value: ProjectStatus, language: Language) {
  const values = language === "zh"
    ? { operational: "已有容量", construction: "建设观察", unknown: "未知" }
    : { operational: "Capacity online", construction: "Construction observed", unknown: "Unknown" };
  return values[value];
}

function freshnessLabel(value: Freshness, language: Language) {
  const values = language === "zh"
    ? { current: "Current", aging: "Aging", stale: "Stale", unknown: "Unknown" }
    : { current: "Current", aging: "Aging", stale: "Stale", unknown: "Unknown" };
  return values[value];
}

export function AICapex({ language }: { language: Language }) {
  const text = labels(language);
  const [data, setData] = useState<CapexPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [ownerMetric, setOwnerMetric] = useState<OwnerMetric>("currentItMw");
  const [projectMetric, setProjectMetric] = useState<ProjectMetric>("itMw");
  const [owner, setOwner] = useState("all");
  const [country, setCountry] = useState("all");
  const [status, setStatus] = useState("all");
  const [confidence, setConfidence] = useState("all");
  const [freshness, setFreshness] = useState("all");
  const [selectedProjectId, setSelectedProjectId] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/data/aidc-capex/dashboard.json", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`AI Capex snapshot unavailable (${response.status})`);
        return response.json() as Promise<CapexPayload>;
      })
      .then((payload) => {
        if (!active) return;
        if (payload.schemaVersion !== "aidc-capex.v1") throw new Error("Unsupported AI Capex schema");
        setData(payload);
        setSelectedProjectId((current) => current || payload.projects[0]?.id || "");
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "AI Capex snapshot unavailable");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadVersion]);

  const filters = useMemo(() => {
    if (!data) return { owners: [], countries: [], statuses: [], confidences: [], freshness: [] };
    return {
      owners: [...new Set(data.projects.map((project) => project.owner))].sort(),
      countries: [...new Set(data.projects.map((project) => project.country))].sort(),
      statuses: [...new Set(data.projects.map((project) => project.status))].sort(),
      confidences: [...new Set(data.projects.map((project) => project.confidence))].sort(),
      freshness: freshnessOrder.filter((item) => data.projects.some((project) => project.freshness === item)),
    };
  }, [data]);

  const filteredProjects = useMemo(() => {
    if (!data) return [];
    return data.projects.filter((project) => (
      (owner === "all" || project.owner === owner)
      && (country === "all" || project.country === country)
      && (status === "all" || project.status === status)
      && (confidence === "all" || project.confidence === confidence)
      && (freshness === "all" || project.freshness === freshness)
    ));
  }, [confidence, country, data, freshness, owner, status]);

  const selectedProject = useMemo(() => {
    if (!data) return null;
    return filteredProjects.find((project) => project.id === selectedProjectId)
      || filteredProjects[0]
      || null;
  }, [data, filteredProjects, selectedProjectId]);

  const ownerChart = useMemo(() => {
    if (!data) return [];
    const required = ["Microsoft", "Meta", "Amazon", "Google", "Oracle", "xAI"];
    return data.owners
      .filter((row) => required.includes(row.owner) || row[ownerMetric] > 0)
      .sort((a, b) => b[ownerMetric] - a[ownerMetric])
      .slice(0, 10)
      .map((row) => ({
        ...row,
        status: "operational baseline",
        observationDate: data.kpis.observationDate || undefined,
      }));
  }, [data, ownerMetric]);

  const visibleTimeline = useMemo(() => (
    data?.capacityTimeline.filter((point) => Number(point.quarter.slice(0, 4)) >= 2022) || []
  ), [data]);

  const visibleSources = useMemo(() => {
    if (!data) return [];
    const projectSourceIds = selectedProject?.sourceIds || ["S001", "S002"];
    const ids = new Set(["S001", "S002", "S003", "S004", ...projectSourceIds]);
    return data.sources.filter((source) => ids.has(source.id));
  }, [data, selectedProject]);

  const resetFilters = () => {
    setOwner("all");
    setCountry("all");
    setStatus("all");
    setConfidence("all");
    setFreshness("all");
  };
  const retry = () => {
    setLoading(true);
    setError("");
    setReloadVersion((current) => current + 1);
  };

  if (loading) {
    return <div className="aidc-state"><i className="button-spinner" /><strong>{text.loading}</strong><span>Epoch AI · aidc-capex.v1</span></div>;
  }
  if (error || !data) {
    return (
      <div className="aidc-state aidc-state-error">
        <strong>{error || "AI Capex snapshot unavailable"}</strong>
        <span>Portable data remains separate from the research repository.</span>
        <button className="quiet-button" onClick={retry}>{text.retry}</button>
      </div>
    );
  }

  const metricConfig: Record<OwnerMetric, { label: string; unit: string }> = {
    currentItMw: { label: "IT MW", unit: "MW" },
    currentH100e: { label: "H100e", unit: "H100e" },
    estimatedCapitalCostUsdBn: { label: language === "zh" ? "估算资本成本" : "Estimated capital cost", unit: "2025 USD bn" },
  };
  const projectMetricConfig: Record<ProjectMetric, { label: string; unit: string }> = {
    itMw: { label: "IT MW", unit: "MW" },
    h100e: { label: "H100e", unit: "H100e" },
    estimatedCapitalCostUsdBn: { label: language === "zh" ? "估算成本" : "Estimated cost", unit: "2025 USD bn" },
  };

  return (
    <section className="aidc-dashboard">
      <div className="aidc-meta-strip">
        <strong>{text.baseline}</strong>
        <span>{text.cutoff}：{data.dataCutoff}</span>
        <span>{text.synced}：{data.syncedAtHkt}</span>
        <em>{text.partial} · {data.reviewStatus}</em>
      </div>

      <section className="aidc-kpis" aria-label="AI Capex summary metrics">
        {[
          [text.campuses, compactNumber(data.kpis.campuses, 0), "campuses", "Epoch AI campus-level coverage"],
          [text.itMw, compactNumber(data.kpis.currentItMw), "MW", data.metricMethods.currentItMw],
          [text.h100e, compactNumber(data.kpis.currentH100e, 1), "H100e", data.metricMethods.currentH100e],
          [text.cost, `$${compactNumber(data.kpis.estimatedCapitalCostUsdBn, 2)}bn`, "2025 USD", data.metricMethods.estimatedCapitalCostUsdBn],
          [text.cutoff, data.dataCutoff, "research cutoff", "Latest evidence included in this export"],
          [text.synced, data.syncedAtHkt.replace(" HKT", ""), "HKT", "Level Grind import time; not source freshness"],
        ].map(([label, value, unit, method]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{unit}</small>
            <EvidenceLine
              ids={data.kpis.sourceIds}
              observationDate={data.kpis.observationDate}
              payload={data}
              method={method}
            />
          </article>
        ))}
      </section>

      <div className="aidc-chart-grid">
        <section className="aidc-panel aidc-owner-panel">
          <header className="aidc-panel-head">
            <div><p className="eyebrow">OWNER CAPACITY</p><h2>{text.ownerTitle}</h2><span>{text.ownerNote}</span></div>
            <div className="aidc-toggle" role="group" aria-label="Owner capacity metric">
              {(Object.keys(metricConfig) as OwnerMetric[]).map((metric) => (
                <button key={metric} className={ownerMetric === metric ? "active" : ""} onClick={() => setOwnerMetric(metric)}>
                  {metricConfig[metric].label}
                </button>
              ))}
            </div>
          </header>
          <div className="aidc-chart">
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={ownerChart} layout="vertical" margin={{ top: 8, right: 28, left: 18, bottom: 8 }}>
                <CartesianGrid stroke="#e3e5df" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="owner" type="category" width={84} tick={{ fontSize: 10 }} />
                <Tooltip content={<ResearchTooltip metric={ownerMetric} language={language} />} />
                <Bar dataKey={ownerMetric} name={metricConfig[ownerMetric].label} fill="#2f6b54" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <EvidenceLine ids={["S001", "S002"]} observationDate={data.kpis.observationDate} payload={data} method={data.metricMethods[ownerMetric]} />
        </section>

        <section className="aidc-panel aidc-pipeline-panel">
          <header className="aidc-panel-head">
            <div><p className="eyebrow">STATUS BASELINE</p><h2>{text.pipelineTitle}</h2><span>{text.pipelineNote}</span></div>
          </header>
          <div className="aidc-chart">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.statusPipeline.map((row) => ({
                ...row,
                label: statusLabel(row.status, language),
                observationDate: data.kpis.observationDate || undefined,
              }))} margin={{ top: 8, right: 18, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="#e3e5df" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={<ResearchTooltip metric="campuses" language={language} />} />
                <Bar dataKey="campuses" name={language === "zh" ? "园区数" : "Campuses"} radius={[5, 5, 0, 0]}>
                  {data.statusPipeline.map((row) => <Cell key={row.status} fill={statusColors[row.status]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="aidc-freshness-summary">
            {freshnessOrder.map((item) => (
              <span key={item} className={`freshness-${item}`}>
                {freshnessLabel(item, language)}
                <strong>{data.projects.filter((project) => project.freshness === item).length}</strong>
              </span>
            ))}
          </div>
          <EvidenceLine ids={["S001", "S002"]} observationDate={data.kpis.observationDate} payload={data} method="Campus count by Epoch baseline current-capacity status; no delay probability." />
        </section>
      </div>

      <section className="aidc-panel aidc-timeline-panel">
        <header className="aidc-panel-head">
          <div><p className="eyebrow">CAPACITY BUILDOUT</p><h2>{text.buildoutTitle}</h2><span>{text.buildoutNote}</span></div>
          <span className="aidc-no-forecast">p10 / p50 / p90 · {data.reviewedForecasts.length ? "reviewed" : text.pilot}</span>
        </header>
        <div className="aidc-chart aidc-wide-chart">
          <ResponsiveContainer width="100%" height={330}>
            <LineChart data={visibleTimeline} margin={{ top: 12, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="#e3e5df" vertical={false} />
              <XAxis dataKey="quarter" tick={{ fontSize: 9 }} minTickGap={22} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => compactNumber(Number(value), 0)} />
              <Tooltip content={<ResearchTooltip metric="itMw" language={language} />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="historicalItMw" name={text.history} stroke="#2f6b54" strokeWidth={2.5} dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="epochBaselinePlannedItMw" name={text.planned} stroke="#c99c3c" strokeWidth={2.2} strokeDasharray="7 5" dot={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <EvidenceLine ids={["S001", "S002"]} observationDate={data.kpis.observationDate} payload={data} method={data.metricMethods.capacityTimeline} />
      </section>

      <section className="aidc-panel aidc-matrix-panel">
        <header className="aidc-panel-head">
          <div><p className="eyebrow">PROJECT SCREEN</p><h2>{text.projectMatrix}</h2><span>{filteredProjects.length} {text.projectCount}</span></div>
          <button className="quiet-button" onClick={resetFilters}>{text.reset}</button>
        </header>
        <div className="aidc-filters">
          {[
            [text.owner, owner, setOwner, filters.owners],
            [text.country, country, setCountry, filters.countries],
            [text.status, status, setStatus, filters.statuses],
            [text.confidence, confidence, setConfidence, filters.confidences],
            [text.freshness, freshness, setFreshness, filters.freshness],
          ].map(([label, value, setter, options]) => (
            <label key={String(label)}>
              <span>{String(label)}</span>
              <select value={String(value)} onChange={(event) => (setter as (next: string) => void)(event.target.value)}>
                <option value="all">{text.all}</option>
                {(options as string[]).map((option) => (
                  <option key={option} value={option}>
                    {label === text.status ? statusLabel(option as ProjectStatus, language) : option}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {!filteredProjects.length ? (
          <div className="aidc-empty-state">
            <strong>{text.noProjects}</strong><span>{text.noProjectsBody}</span>
            <button className="quiet-button" onClick={resetFilters}>{text.reset}</button>
          </div>
        ) : (
          <div className="aidc-table-wrap">
            <table className="aidc-project-table">
              <thead><tr>
                <th>{text.project}</th><th>{text.owner}</th><th>{text.location}</th><th>IT MW</th><th>H100e</th>
                <th>{text.chips}</th><th>{language === "zh" ? "估算成本" : "Est. cost"}</th><th>{text.status}</th>
                <th>{text.observation}</th><th>{text.freshness}</th><th>{text.confidence}</th>
              </tr></thead>
              <tbody>
                {filteredProjects.map((project) => (
                  <tr
                    key={project.id}
                    className={selectedProject?.id === project.id ? "selected" : ""}
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    <td><button onClick={() => setSelectedProjectId(project.id)}><strong>{project.name}</strong><small>{text.openProject} →</small></button></td>
                    <td>{project.owner}</td>
                    <td><strong>{project.country}</strong><small>{project.address || "—"}</small></td>
                    <td>{compactNumber(project.currentItMw)}</td>
                    <td>{compactNumber(project.currentH100e, 1)}</td>
                    <td>{project.currentChipTypes.join(", ") || "—"}</td>
                    <td>${compactNumber(project.estimatedCapitalCostUsdBn, 2)}bn</td>
                    <td><span className={`aidc-status status-${project.status}`}>{statusLabel(project.status, language)}</span></td>
                    <td>{date(project.observationDate)}</td>
                    <td><span className={`aidc-freshness freshness-${project.freshness}`}>{freshnessLabel(project.freshness, language)}</span></td>
                    <td>{project.confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <EvidenceLine ids={["S001", "S002"]} observationDate={data.kpis.observationDate} payload={data} method="Project-level Epoch baseline; freshness uses observation date versus data cutoff." />
      </section>

      {selectedProject && (
        <section className="aidc-panel aidc-detail-panel">
          <header className="aidc-project-head">
            <div>
              <p className="eyebrow">SELECTED PROJECT</p>
              <h2>{selectedProject.name}</h2>
              <span>{selectedProject.owner} · {selectedProject.country} · {selectedProject.address || "Address unavailable"}</span>
            </div>
            <div>
              <span className={`aidc-status status-${selectedProject.status}`}>{statusLabel(selectedProject.status, language)}</span>
              <span className={`aidc-freshness freshness-${selectedProject.freshness}`}>{freshnessLabel(selectedProject.freshness, language)}</span>
            </div>
          </header>

          <div className="aidc-project-kpis">
            <article><span>IT MW</span><strong>{compactNumber(selectedProject.currentItMw)}</strong></article>
            <article><span>H100e</span><strong>{compactNumber(selectedProject.currentH100e, 1)}</strong></article>
            <article><span>{language === "zh" ? "估算成本" : "Estimated cost"}</span><strong>${compactNumber(selectedProject.estimatedCapitalCostUsdBn, 2)}bn</strong></article>
            <article><span>{text.observation}</span><strong>{date(selectedProject.observationDate)}</strong></article>
          </div>

          <div className="aidc-detail-grid">
            <section>
              <div className="aidc-subhead">
                <div><h3>{text.metricHistory}</h3><span>{projectMetricConfig[projectMetric].unit}</span></div>
                <div className="aidc-toggle">
                  {(Object.keys(projectMetricConfig) as ProjectMetric[]).map((metric) => (
                    <button key={metric} className={projectMetric === metric ? "active" : ""} onClick={() => setProjectMetric(metric)}>
                      {projectMetricConfig[metric].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="aidc-chart">
                <ResponsiveContainer width="100%" height={290}>
                  <LineChart data={selectedProject.timeline.map((point) => ({
                    ...point,
                    historicalValue: point.period === "historical-current" ? point[projectMetric] : null,
                    plannedValue: point.period === "epoch-baseline-plan" ? point[projectMetric] : null,
                    status: point.period,
                    observationDate: point.date,
                  }))} margin={{ top: 10, right: 20, left: 4, bottom: 8 }}>
                    <CartesianGrid stroke="#e3e5df" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} minTickGap={24} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => compactNumber(Number(value), 0)} />
                    <Tooltip content={<ResearchTooltip metric={projectMetric} language={language} />} />
                    <Line
                      type="stepAfter"
                      dataKey="historicalValue"
                      name={text.history}
                      stroke="#2f6b54"
                      strokeWidth={2.4}
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                    <Line
                      type="stepAfter"
                      dataKey="plannedValue"
                      name={text.planned}
                      stroke="#c99c3c"
                      strokeWidth={2.2}
                      strokeDasharray="7 5"
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <EvidenceLine ids={selectedProject.sourceIds} observationDate={selectedProject.observationDate} payload={data} method={data.metricMethods[projectMetric === "itMw" ? "currentItMw" : projectMetric === "h100e" ? "currentH100e" : "estimatedCapitalCostUsdBn"]} />
            </section>

            <section>
              <div className="aidc-subhead"><div><h3>{text.chipHistory}</h3><span>{selectedProject.currentChipTypes.join(", ") || text.partial}</span></div></div>
              {selectedProject.chipQuantities.length ? (
                <div className="aidc-chart">
                  <ResponsiveContainer width="100%" height={290}>
                    <BarChart data={selectedProject.chipQuantities.map((point) => ({
                      ...point,
                      historicalUnits: point.date <= data.dataCutoff ? point.units : null,
                      plannedUnits: point.date > data.dataCutoff ? point.units : null,
                      status: point.date <= data.dataCutoff ? "historical-current" : "epoch-baseline-plan",
                      observationDate: point.date,
                    }))} margin={{ top: 10, right: 18, left: 4, bottom: 8 }}>
                      <CartesianGrid stroke="#e3e5df" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => compactNumber(Number(value), 0)} />
                      <Tooltip content={<ResearchTooltip metric="units" language={language} />} />
                      <Bar dataKey="historicalUnits" name={text.history} fill="#2f6b54" radius={[5, 5, 0, 0]} />
                      <Bar dataKey="plannedUnits" name={text.planned} fill="#c99c3c" fillOpacity={0.62} radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="aidc-chart-empty">{text.pilot} · {language === "zh" ? "没有园区—芯片—日期记录" : "No site-chip-date record"}</div>}
              <EvidenceLine ids={["S001", "S004"]} observationDate={selectedProject.observationDate} payload={data} method="Epoch site-chip-date estimates; chip ownership does not prove deployment at a campus." />
            </section>
          </div>

          <div className="aidc-detail-bottom">
            <section className="aidc-milestones">
              <div className="aidc-subhead"><div><h3>{text.milestones}</h3><span>{selectedProject.timeline.length}</span></div></div>
              {[...selectedProject.timeline].reverse().map((point) => (
                <article key={`${point.date}-${point.constructionStatus}`}>
                  <time>{point.date}</time>
                  <span className={point.period === "epoch-baseline-plan" ? "planned" : "observed"}>
                    {point.period === "epoch-baseline-plan" ? text.planned : text.history}
                  </span>
                  <p>{point.constructionStatus || "Metric update without a narrative milestone."}</p>
                  <small>{metricValue(point.itMw, "itMw")} · {metricValue(point.h100e, "h100e")} · <SourceLinks ids={point.sourceIds} /></small>
                </article>
              ))}
            </section>
            <section className="aidc-method-card">
              <p className="eyebrow">METHOD & BOUNDARY</p>
              <h3>{text.calculation}</h3>
              <p>{selectedProject.statusBasis}</p>
              <p>{selectedProject.confidenceBasis}</p>
              <p>{data.metricMethods.estimatedCapitalCostUsdBn}</p>
              {selectedProject.calculationSheetUrl && (
                <a href={selectedProject.calculationSheetUrl} target="_blank" rel="noreferrer">{text.calculationOpen} ↗</a>
              )}
              <EvidenceLine ids={selectedProject.sourceIds} observationDate={selectedProject.observationDate} payload={data} method="Epoch calculation links and referenced public evidence; third-party rights remain link-only." />
            </section>
          </div>
        </section>
      )}

      <section className="aidc-research-pilot">
        <div><p className="eyebrow">EVIDENCE BOUNDARY</p><h2>{text.pilot}</h2><p>{text.pilotBody}</p></div>
        <ul>{data.knownLimitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
      </section>

      <section className="aidc-panel aidc-sources-panel">
        <header className="aidc-panel-head">
          <div><p className="eyebrow">LINEAGE</p><h2>{text.sources}</h2><span>{visibleSources.length} / {data.recordCounts.sources} · {selectedProject?.name || text.all}</span></div>
          <div className="aidc-freshness-method">
            <span>Current {data.freshnessMethod.currentDays}d</span>
            <span>Aging {data.freshnessMethod.agingDays}d</span>
            <span>Stale {data.freshnessMethod.staleDays}d</span>
          </div>
        </header>
        <div className="aidc-table-wrap">
          <table className="aidc-sources-table">
            <thead><tr>
              <th>{text.sourceId}</th><th>{text.publisher}</th><th>{text.title}</th><th>{text.sourceType}</th>
              <th>{text.sourceDate}</th><th>{text.observationDate}</th><th>{text.accessedDate}</th>
              <th>{text.url}</th><th>{text.rights}</th><th>{text.verification}</th>
            </tr></thead>
            <tbody>
              {visibleSources.map((source) => (
                <tr key={source.id} id={`aidc-source-${source.id}`}>
                  <td>[{sourceNumber(source.id)}]</td>
                  <td>{source.publisher}</td>
                  <td>{source.title}</td>
                  <td>{source.sourceType}</td>
                  <td>{date(source.sourceDate)}</td>
                  <td>{date(source.observationDate)}</td>
                  <td>{source.accessedAt}</td>
                  <td><a href={source.urlOrAssetId} target="_blank" rel="noreferrer">{source.urlOrAssetId} ↗</a></td>
                  <td>{source.rightsStatus}</td>
                  <td>{source.verificationStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
