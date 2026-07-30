"use client";

import { useEffect, useMemo, useState } from "react";
import { geoEqualEarth, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Language } from "./i18n";

type Freshness = "current" | "aging" | "stale" | "unknown";
type Confidence = "high" | "medium" | "low" | "unknown";
type ProjectStatus = "operational" | "construction" | "unknown";

type TimelinePoint = {
  date: string;
  quarter: string;
  period: "historical-current" | "epoch-baseline-plan";
  constructionStatus: string | null;
  buildingsOperational: number | null;
  itMw: number | null;
  h100e: number | null;
  estimatedCapitalCostUsdBn: number | null;
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
  allChipTypes?: string[];
  status: ProjectStatus;
  confidence: Confidence;
  observationDate: string | null;
  freshness: Freshness;
  latestMilestone: string | null;
  calculationSheetUrl: string | null;
  sourceIds: string[];
  timeline: TimelinePoint[];
  chipQuantities: Array<{ date: string; chipType: string; units: number | null }>;
};

type SourceRecord = {
  id: string;
  publisher: string;
  title: string;
  urlOrAssetId: string;
};

type CapexPayload = {
  schemaVersion: string;
  generatedAt: string;
  syncedAtHkt: string;
  dataCutoff: string;
  kpis: {
    campuses: number;
    currentItMw: number;
    currentH100e: number;
    estimatedCapitalCostUsdBn: number;
    observationDate: string | null;
  };
  projects: CapexProject[];
  sources: SourceRecord[];
};

type Geocode = {
  latitude: number | null;
  longitude: number | null;
  precision: "address" | "place" | "unresolved";
  displayName: string | null;
  source: string;
  sourceUrl: string | null;
};
type CapexSortField = "currentItMw" | "currentH100e" | "estimatedCapitalCostUsdBn" | "observationDate" | "name" | "owner";
type SortDirection = "desc" | "asc";

const statusColors: Record<ProjectStatus, string> = {
  operational: "#2f6b54",
  construction: "#4f78a6",
  unknown: "#929a95",
};

function compact(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en", {
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: digits,
  }).format(value);
}

function statusLabel(status: ProjectStatus, language: Language) {
  if (language === "en") return status === "operational" ? "Operational" : status === "construction" ? "Construction" : "Unknown";
  return status === "operational" ? "运营中" : status === "construction" ? "建设中" : "未知";
}

function sourceIndex(id: string) {
  return Number(id.replace(/\D/g, "")) || id;
}

function WorldMap({
  projects,
  geocodes,
  selectedId,
  onSelect,
}: {
  projects: CapexProject[];
  geocodes: Record<string, Geocode>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const width = 1200;
  const height = 560;
  const projection = useMemo(() => geoEqualEarth().fitExtent([[16, 14], [width - 16, height - 14]], { type: "Sphere" }), []);
  const countries = useMemo(() => feature(world as never, (world as unknown as { objects: { countries: never } }).objects.countries), []);
  const path = useMemo(() => geoPath(projection), [projection]);
  const points = projects.flatMap((project) => {
    const location = geocodes[project.id];
    if (!location?.latitude || !location.longitude) return [];
    const coordinates = projection([location.longitude, location.latitude]);
    return coordinates ? [{ project, location, x: coordinates[0], y: coordinates[1] }] : [];
  });

  return (
    <div className="aidc-world-map">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="AI data center project world map">
        <rect width={width} height={height} rx="18" fill="#edf1ec" />
        <path d={path({ type: "Sphere" }) || ""} fill="#f8f7f1" stroke="#c9d2ca" />
        {(countries as unknown as { features: Array<unknown> }).features.map((country, index) => (
          <path key={index} d={path(country as never) || ""} fill="#e1e6df" stroke="#f8f7f1" strokeWidth=".7" />
        ))}
        {points.map(({ project, location, x, y }) => (
          <g
            key={project.id}
            className={selectedId === project.id ? "aidc-map-point selected" : "aidc-map-point"}
            onClick={() => onSelect(project.id)}
            tabIndex={0}
            role="button"
            aria-label={`${project.name}, ${project.country}`}
          >
            <circle
              cx={x}
              cy={y}
              r={Math.max(5, Math.min(18, 5 + Math.sqrt(project.currentItMw || 0) / 4))}
              fill={statusColors[project.status]}
              fillOpacity=".76"
              stroke="#fff"
              strokeWidth={selectedId === project.id ? 4 : 2}
            />
            <title>
              {`${project.name}\n${project.owner} · ${project.country}\n${compact(project.currentItMw)} MW · ${statusLabel(project.status, "zh")}\n定位：${location.precision === "address" ? "地址级" : "地点级"}`}
            </title>
          </g>
        ))}
      </svg>
      <div className="aidc-map-legend">
        <span><i style={{ background: statusColors.operational }} />运营中</span>
        <span><i style={{ background: statusColors.construction }} />建设中</span>
        <span><i style={{ background: statusColors.unknown }} />未知</span>
        <small>气泡大小：当前 IT MW</small>
      </div>
    </div>
  );
}

export function AICapex({ language }: { language: Language }) {
  const [data, setData] = useState<CapexPayload | null>(null);
  const [geocodes, setGeocodes] = useState<Record<string, Geocode>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("all");
  const [country, setCountry] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortField, setSortField] = useState<CapexSortField>("currentItMw");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/data/aidc-capex/dashboard.json", { cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error("AI Capex 数据暂时不可用");
        return response.json() as Promise<CapexPayload>;
      }),
      fetch("/data/aidc-capex/geocodes.json", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<Record<string, Geocode>> : {}),
    ]).then(([payload, locations]) => {
      setData(payload);
      setGeocodes(locations);
      setSelectedId(payload.projects[0]?.id || "");
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "AI Capex 数据暂时不可用"))
      .finally(() => setLoading(false));
  }, []);

  const options = useMemo(() => {
    const projects = data?.projects || [];
    return {
      owners: [...new Set(projects.map((item) => item.owner))].sort(),
      countries: [...new Set(projects.map((item) => item.country))].sort(),
      statuses: [...new Set(projects.map((item) => item.status))].sort(),
    };
  }, [data]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.projects || []).filter((project) => (
      (!needle || [project.name, project.owner, project.country, project.address, ...project.currentChipTypes].filter(Boolean).join(" ").toLowerCase().includes(needle))
      && (owner === "all" || project.owner === owner)
      && (country === "all" || project.country === country)
      && (status === "all" || project.status === status)
    )).sort((left, right) => {
      const leftValue = sortField === "observationDate"
        ? (left.observationDate ? Date.parse(left.observationDate) : null)
        : sortField === "name" || sortField === "owner"
          ? left[sortField]
          : left[sortField];
      const rightValue = sortField === "observationDate"
        ? (right.observationDate ? Date.parse(right.observationDate) : null)
        : sortField === "name" || sortField === "owner"
          ? right[sortField]
          : right[sortField];
      if (leftValue === null || leftValue === "") return rightValue === null || rightValue === "" ? 0 : 1;
      if (rightValue === null || rightValue === "") return -1;
      const ordered = typeof leftValue === "string" && typeof rightValue === "string"
        ? leftValue.localeCompare(rightValue)
        : Number(leftValue) - Number(rightValue);
      return sortDirection === "asc" ? ordered : -ordered;
    });
  }, [country, data, owner, query, sortDirection, sortField, status]);

  const selected = filtered.find((project) => project.id === selectedId) || filtered[0] || null;
  const sourceMap = new Map((data?.sources || []).map((source) => [source.id, source]));
  const locatedProjectCount = data.projects.filter((project) => {
    const location = geocodes[project.id];
    return location?.latitude !== null && location?.latitude !== undefined
      && location?.longitude !== null && location?.longitude !== undefined;
  }).length;
  const unresolvedProjectCount = data.projects.length - locatedProjectCount;

  if (loading) return <div className="aidc-state"><i className="button-spinner" />正在载入 75 个园区…</div>;
  if (error || !data) return <div className="aidc-state aidc-state-error">{error || "AI Capex 数据暂时不可用"}</div>;

  const kpis = [
    ["覆盖园区数", compact(data.kpis.campuses, 0), "campuses"],
    ["当前 IT MW", compact(data.kpis.currentItMw), "MW"],
    ["当前 H100-equivalent", compact(data.kpis.currentH100e, 1), "H100e"],
    ["当前估算资本成本", `$${compact(data.kpis.estimatedCapitalCostUsdBn, 2)}bn`, "2025 USD"],
    ["数据截至", data.dataCutoff, "research cutoff"],
    ["Level Grind 同步", data.syncedAtHkt.replace(" HKT", ""), "HKT"],
  ];

  return (
    <section className="aidc-dashboard aidc-compact">
      <section className="aidc-kpis aidc-kpis-compact">
        {kpis.map(([label, value, unit]) => (
          <article key={label}><span>{label}</span><strong>{value}</strong><small>{unit}</small></article>
        ))}
      </section>
      <div className="aidc-snapshot-note">
        <span>Epoch AI baseline · Observation {data.kpis.observationDate || "—"} · CC BY 4.0</span>
        <a href="https://epoch.ai/data/ai-data-centers" target="_blank" rel="noreferrer">打开原始数据 ↗</a>
      </div>

      <section className="aidc-panel aidc-matrix-panel">
        <header className="aidc-panel-head">
          <div><p className="eyebrow">PROJECT MATRIX</p><h2>项目矩阵</h2><span>{filtered.length} / {data.projects.length}</span></div>
          <button className="quiet-button" onClick={() => {
            setQuery(""); setOwner("all"); setCountry("all"); setStatus("all");
          }}>清除筛选</button>
        </header>
        <div className="aidc-filters aidc-filters-dense">
          <label className="aidc-search"><span>搜索</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="项目、业主、地址、芯片" /></label>
          {[
            ["业主", owner, setOwner, options.owners],
            ["国家", country, setCountry, options.countries],
            ["状态", status, setStatus, options.statuses],
          ].map(([label, value, setter, values]) => (
            <label key={String(label)}><span>{String(label)}</span>
              <select value={String(value)} onChange={(event) => (setter as (next: string) => void)(event.target.value)}>
                <option value="all">全部</option>
                {(values as string[]).map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          ))}
          <label><span>排序</span>
            <select value={sortField} onChange={(event) => setSortField(event.target.value as CapexSortField)}>
              <option value="currentItMw">IT MW</option><option value="currentH100e">H100e</option>
              <option value="estimatedCapitalCostUsdBn">估算成本</option><option value="observationDate">观察日期</option>
              <option value="name">项目名称</option><option value="owner">业主</option>
            </select>
          </label>
          <label><span>顺序</span>
            <select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as SortDirection)}>
              <option value="desc">从高到低 / 最新</option><option value="asc">从低到高 / 最早</option>
            </select>
          </label>
        </div>
        <div className="aidc-table-wrap">
          <table className="aidc-project-table">
            <thead><tr><th>项目</th><th>业主</th><th>国家 / 地址</th><th>IT MW</th><th>H100e</th><th>芯片</th><th>估算成本</th><th>状态</th><th>观察日</th><th>新鲜度</th></tr></thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="aidc-empty-state">没有符合当前筛选条件的项目。</td></tr>
                )}
                {filtered.map((project) => (
                  <tr key={project.id} className={selected?.id === project.id ? "selected" : ""} onClick={() => setSelectedId(project.id)}>
                    <td><button onClick={() => setSelectedId(project.id)}><strong>{project.name}</strong><small>查看详情 →</small></button></td>
                    <td>{project.owner}</td>
                    <td><strong>{project.country}</strong><small>{project.address || "地址待补"}</small></td>
                    <td>{compact(project.currentItMw)}</td>
                    <td>{compact(project.currentH100e, 1)}</td>
                    <td>{project.currentChipTypes.join(", ") || "—"}</td>
                    <td>${compact(project.estimatedCapitalCostUsdBn, 2)}bn</td>
                    <td><span className={`aidc-status status-${project.status}`}>{statusLabel(project.status, language)}</span></td>
                    <td>{project.observationDate || "—"}</td>
                    <td><span className={`aidc-freshness freshness-${project.freshness}`}>{project.freshness}</span></td>
                  </tr>
                ))}
              </tbody>
          </table>
        </div>
      </section>

      <section className="aidc-panel aidc-map-panel">
        <header className="aidc-panel-head">
          <div>
            <p className="eyebrow">GLOBAL BUILDOUT</p>
            <h2>全球建设进展</h2>
            <span>{locatedProjectCount} 个已定位园区 · {unresolvedProjectCount} 个待定位</span>
          </div>
        </header>
        <WorldMap projects={filtered} geocodes={geocodes} selectedId={selected?.id || ""} onSelect={setSelectedId} />
      </section>

      {selected && (
        <section className="aidc-panel aidc-detail-panel">
          <header className="aidc-project-head">
            <div><p className="eyebrow">PROJECT DETAIL</p><h2>{selected.name}</h2><span>{selected.owner} · {selected.country} · {selected.address || "地址待补"}</span></div>
            <div>
              <span className={`aidc-status status-${selected.status}`}>{statusLabel(selected.status, language)}</span>
              {geocodes[selected.id]?.sourceUrl && <a href={geocodes[selected.id].sourceUrl!} target="_blank" rel="noreferrer">地图 ↗</a>}
            </div>
          </header>
          <div className="aidc-project-kpis">
            <article><span>IT MW</span><strong>{compact(selected.currentItMw)}</strong></article>
            <article><span>H100e</span><strong>{compact(selected.currentH100e, 1)}</strong></article>
            <article><span>估算成本</span><strong>${compact(selected.estimatedCapitalCostUsdBn, 2)}bn</strong></article>
            <article><span>芯片</span><strong>{selected.currentChipTypes.join(", ") || "—"}</strong></article>
          </div>
          <div className="aidc-project-visual">
            <section className="aidc-site-card">
              <div className="aidc-site-orbit">
                <span>{statusLabel(selected.status, language)}</span>
                <strong>{compact(selected.currentItMw)} MW</strong>
                <small>{geocodes[selected.id]?.precision === "address" ? "地址级定位" : "地点级定位"}</small>
              </div>
              <h3>{selected.name}</h3>
              <p>{geocodes[selected.id]?.displayName || selected.address || selected.country}</p>
              <div className="aidc-source-chips">
                {selected.sourceIds.slice(0, 8).map((id) => {
                  const source = sourceMap.get(id);
                  return source ? <a key={id} href={source.urlOrAssetId} target="_blank" rel="noreferrer" title={source.title}>[{sourceIndex(id)}] {source.publisher}</a> : null;
                })}
              </div>
            </section>
            <section className="aidc-progress-chart">
              <ResponsiveContainer width="100%" height={330}>
                <LineChart data={selected.timeline} margin={{ top: 24, right: 22, left: 6, bottom: 8 }}>
                  <CartesianGrid stroke="#e3e5df" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} minTickGap={24} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => [`${value} MW`, "IT MW"]} />
                  <ReferenceLine x={data.dataCutoff} stroke="#be8e36" strokeDasharray="4 4" label="cutoff" />
                  <Line type="stepAfter" dataKey="itMw" stroke="#2f6b54" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </section>
          </div>
          <div className="aidc-milestone-strip">
            {selected.timeline.map((point) => (
              <article key={`${point.date}-${point.quarter}`}>
                <time>{point.date}</time>
                <strong>{point.constructionStatus || `${compact(point.itMw)} MW`}</strong>
                <small>{point.period === "epoch-baseline-plan" ? "规划" : "观察"} · {point.sourceIds.map((id) => `[${sourceIndex(id)}]`).join(" ")}</small>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
