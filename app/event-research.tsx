"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Horizon = { date: string | null; close: number | null; return: number | null; abnormal: number | null };
type ClaimMapping = {
  mappingType: string;
  ticker: string;
  security: string;
  benchmark: string;
  baseDate: string;
  baseClose: number | null;
  returns: Record<"t0" | "t1" | "t3" | "t5", Horizon>;
  publicCheck: { status: string; priceSource: string } | null;
};
type LedgerClaim = {
  claimDateStart: string;
  claimDateEnd: string | null;
  claimTimeHkt: string | null;
  claimId: string;
  eventId: string;
  speaker: string | null;
  entity: string | null;
  title: string;
  originalClaim: string;
  verificationStatus: string | null;
  mappings: ClaimMapping[];
};
type SecuritySeries = {
  ticker: string;
  source: string | null;
  prices: Array<{ date: string; close: number; source: string }>;
};
type ClaimLedgerPayload = {
  schemaVersion: string;
  dataCutoff: string;
  claims: LedgerClaim[];
  securities: SecuritySeries[];
};
type LiveClaim = {
  id: string;
  claim_text: string;
  claimed_at?: string;
  speaker?: string;
  company?: string;
  ticker?: string;
  source_system: string;
  verification_status: string;
};
type Draft = {
  claimDateStart: string;
  claimTimeHkt: string;
  speaker: string;
  entity: string;
  title: string;
  originalClaim: string;
};

const horizons = ["t0", "t1", "t3", "t5"] as const;
const horizonLabels = { t0: "T+0", t1: "T+1", t3: "T+3", t5: "T+5" };
const emptyDraft: Draft = {
  claimDateStart: "",
  claimTimeHkt: "",
  speaker: "",
  entity: "",
  title: "",
  originalClaim: "",
};

function loadLocalEdits() {
  if (typeof window === "undefined") return { deletedIds: [], overrides: {}, added: [] };
  try {
    const saved = localStorage.getItem("level-grind.claim-edits.v1");
    return saved ? JSON.parse(saved) : { deletedIds: [], overrides: {}, added: [] };
  } catch {
    return { deletedIds: [], overrides: {}, added: [] };
  }
}

function pct(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function tone(value: number | null) {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

function medianReturn(claim: LedgerClaim, horizon: typeof horizons[number]) {
  const values = claim.mappings.map((mapping) => mapping.returns[horizon]?.return)
    .filter((value): value is number => value !== null && value !== undefined).sort((a, b) => a - b);
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

function toDraft(claim: LedgerClaim): Draft {
  return {
    claimDateStart: claim.claimDateStart,
    claimTimeHkt: claim.claimTimeHkt || "",
    speaker: claim.speaker || "",
    entity: claim.entity || "",
    title: claim.title,
    originalClaim: claim.originalClaim,
  };
}

export function EventResearch({
  liveClaims,
}: {
  liveClaims: LiveClaim[];
  onAsk: (title: string, detail: string) => void;
}) {
  const [data, setData] = useState<ClaimLedgerPayload | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [speaker, setSpeaker] = useState("all");
  const [entity, setEntity] = useState("all");
  const [ticker, setTicker] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [deletedIds, setDeletedIds] = useState<string[]>(() => loadLocalEdits().deletedIds);
  const [overrides, setOverrides] = useState<Record<string, Draft>>(() => loadLocalEdits().overrides);
  const [added, setAdded] = useState<LedgerClaim[]>(() => loadLocalEdits().added);
  const [editing, setEditing] = useState<LedgerClaim | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  useEffect(() => {
    fetch("/data/claim-ledger-dashboard.json", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Claim 数据暂时不可用");
        return response.json() as Promise<ClaimLedgerPayload>;
      })
      .then((payload) => {
        setData(payload);
        setSelectedId(payload.claims[0]?.claimId || "");
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Claim 数据暂时不可用"));
  }, []);

  const persist = (nextDeleted: string[], nextOverrides: Record<string, Draft>, nextAdded: LedgerClaim[]) => {
    localStorage.setItem("level-grind.claim-edits.v1", JSON.stringify({
      deletedIds: nextDeleted,
      overrides: nextOverrides,
      added: nextAdded,
    }));
  };

  const claims = useMemo(() => [
    ...(data?.claims || []).filter((claim) => !deletedIds.includes(claim.claimId)).map((claim) => ({
      ...claim,
      ...(overrides[claim.claimId] || {}),
    })),
    ...added.filter((claim) => !deletedIds.includes(claim.claimId)),
    ...liveClaims.map((claim) => ({
      claimDateStart: claim.claimed_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      claimDateEnd: null,
      claimTimeHkt: claim.claimed_at?.slice(11, 16) || null,
      claimId: claim.id,
      eventId: claim.id,
      speaker: claim.speaker || null,
      entity: claim.company || claim.ticker || null,
      title: claim.claim_text,
      originalClaim: claim.claim_text,
      verificationStatus: claim.verification_status,
      mappings: [],
    })),
  ], [added, data, deletedIds, liveClaims, overrides]);

  const filters = useMemo(() => ({
    speakers: [...new Set(claims.map((claim) => claim.speaker).filter(Boolean) as string[])].sort(),
    entities: [...new Set(claims.map((claim) => claim.entity).filter(Boolean) as string[])].sort(),
    tickers: [...new Set(claims.flatMap((claim) => claim.mappings.map((mapping) => mapping.ticker)))].sort(),
  }), [claims]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return claims.filter((claim) => (
      (!needle || [claim.originalClaim, claim.title, claim.entity, claim.speaker, ...claim.mappings.map((item) => item.ticker)].filter(Boolean).join(" ").toLowerCase().includes(needle))
      && (speaker === "all" || claim.speaker === speaker)
      && (entity === "all" || claim.entity === entity)
      && (ticker === "all" || claim.mappings.some((mapping) => mapping.ticker === ticker))
    ));
  }, [claims, entity, query, speaker, ticker]);

  const selected = filtered.find((claim) => claim.claimId === selectedId) || filtered[0] || null;

  const startEdit = (claim: LedgerClaim | "new") => {
    setEditing(claim);
    setDraft(claim === "new" ? { ...emptyDraft, claimDateStart: new Date().toISOString().slice(0, 10) } : toDraft(claim));
  };

  const saveDraft = () => {
    if (!draft.claimDateStart || !draft.originalClaim.trim()) return;
    if (editing === "new") {
      const nextClaim: LedgerClaim = {
        claimDateStart: draft.claimDateStart,
        claimDateEnd: null,
        claimTimeHkt: draft.claimTimeHkt || null,
        claimId: `CLM-LOCAL-${Date.now()}`,
        eventId: `EVT-LOCAL-${Date.now()}`,
        speaker: draft.speaker || null,
        entity: draft.entity || null,
        title: draft.title || draft.originalClaim.slice(0, 42),
        originalClaim: draft.originalClaim,
        verificationStatus: "待核验",
        mappings: [],
      };
      const nextAdded = [nextClaim, ...added];
      setAdded(nextAdded);
      setSelectedId(nextClaim.claimId);
      persist(deletedIds, overrides, nextAdded);
    } else if (editing) {
      const nextOverrides = { ...overrides, [editing.claimId]: draft };
      setOverrides(nextOverrides);
      persist(deletedIds, nextOverrides, added);
    }
    setEditing(null);
  };

  const removeClaim = (claimId: string) => {
    if (!window.confirm("删除这条 Claim？")) return;
    const nextDeleted = [...deletedIds, claimId];
    setDeletedIds(nextDeleted);
    setSelectedId("");
    persist(nextDeleted, overrides, added);
  };

  if (error) return <div className="empty-state"><h3>{error}</h3></div>;
  if (!data) return <div className="event-research-loading"><i className="button-spinner" />载入 Claim 与价格…</div>;

  return (
    <section className="claim-workbench">
      <div className="claim-toolbar-primary">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 Claim、公司、发言人、股票代码" />
        <button onClick={() => startEdit("new")}>＋ 添加 Claim</button>
      </div>
      <div className="claim-filter-row">
        <select value={speaker} onChange={(event) => setSpeaker(event.target.value)}><option value="all">全部发言人</option>{filters.speakers.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={entity} onChange={(event) => setEntity(event.target.value)}><option value="all">全部公司</option>{filters.entities.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={ticker} onChange={(event) => setTicker(event.target.value)}><option value="all">全部股票</option>{filters.tickers.map((item) => <option key={item}>{item}</option>)}</select>
        <span>{filtered.length} 条 · 数据截至 {data.dataCutoff}</span>
      </div>

      <div className="claim-table-wrap">
        <table className="claim-table">
          <thead><tr><th>日期</th><th>Claim</th><th>公司</th><th>发言人</th><th>证券</th>{horizons.map((item) => <th key={item}>{horizonLabels[item]}</th>)}<th /></tr></thead>
          <tbody>{filtered.map((claim) => (
            <tr key={claim.claimId} className={selected?.claimId === claim.claimId ? "selected" : ""} onClick={() => setSelectedId(claim.claimId)}>
              <td><strong>{claim.claimDateStart}</strong><small>{claim.claimTimeHkt || ""}</small></td>
              <td><button className="claim-title-cell" onClick={() => setSelectedId(claim.claimId)}><strong>{claim.originalClaim}</strong></button></td>
              <td>{claim.entity || "—"}</td>
              <td>{claim.speaker || "待定位"}</td>
              <td>{claim.mappings[0]?.ticker || "—"}{claim.mappings.length > 1 && <small> +{claim.mappings.length - 1}</small>}</td>
              {horizons.map((item) => {
                const value = medianReturn(claim, item);
                return <td key={item} className={`claim-return ${tone(value)}`}>{pct(value)}</td>;
              })}
              <td className="claim-row-actions">
                <button onClick={(event) => { event.stopPropagation(); startEdit(claim); }}>编辑</button>
                <button onClick={(event) => { event.stopPropagation(); removeClaim(claim.claimId); }}>删除</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {selected && <ClaimPriceDetail key={selected.claimId} claim={selected} securities={data.securities} />}

      {editing && (
        <div className="claim-modal-backdrop" onMouseDown={() => setEditing(null)}>
          <form className="claim-editor" onSubmit={(event) => { event.preventDefault(); saveDraft(); }} onMouseDown={(event) => event.stopPropagation()}>
            <header><strong>{editing === "new" ? "添加 Claim" : "编辑 Claim"}</strong><button type="button" onClick={() => setEditing(null)}>×</button></header>
            <div className="claim-editor-grid">
              <label><span>日期</span><input type="date" required value={draft.claimDateStart} onChange={(event) => setDraft({ ...draft, claimDateStart: event.target.value })} /></label>
              <label><span>时间</span><input value={draft.claimTimeHkt} onChange={(event) => setDraft({ ...draft, claimTimeHkt: event.target.value })} placeholder="HH:mm / 晚间" /></label>
              <label><span>公司</span><input value={draft.entity} onChange={(event) => setDraft({ ...draft, entity: event.target.value })} /></label>
              <label><span>发言人 / 负责人</span><input value={draft.speaker} onChange={(event) => setDraft({ ...draft, speaker: event.target.value })} /></label>
            </div>
            <label><span>短标题</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
            <label><span>Claim</span><textarea required value={draft.originalClaim} onChange={(event) => setDraft({ ...draft, originalClaim: event.target.value })} rows={5} /></label>
            <footer><button type="button" onClick={() => setEditing(null)}>取消</button><button type="submit">保存</button></footer>
          </form>
        </div>
      )}
    </section>
  );
}

function ClaimPriceDetail({ claim, securities }: { claim: LedgerClaim; securities: SecuritySeries[] }) {
  const [ticker, setTicker] = useState(claim.mappings[0]?.ticker || "");
  const mapping = claim.mappings.find((item) => item.ticker === ticker) || claim.mappings[0] || null;
  const security = securities.find((item) => item.ticker === mapping?.ticker);
  const path = useMemo(() => {
    if (!mapping || !security?.prices.length || !mapping.baseClose) return [];
    const baseIndex = Math.max(0, security.prices.findIndex((point) => point.date >= mapping.baseDate));
    return security.prices.slice(Math.max(0, baseIndex - 8), Math.min(security.prices.length, baseIndex + 18)).map((point) => ({
      ...point,
      indexed: point.close / mapping.baseClose! * 100,
    }));
  }, [mapping, security]);

  return (
    <section className="claim-price-detail">
      <header>
        <div><p className="eyebrow">PRICE PATH</p><h2>{claim.originalClaim}</h2><span>{claim.claimDateStart} · {claim.entity || "—"} · {claim.speaker || "待定位"}</span></div>
        {claim.mappings.length > 0 && <select value={mapping?.ticker || ""} onChange={(event) => setTicker(event.target.value)}>{claim.mappings.map((item) => <option key={item.ticker} value={item.ticker}>{item.security} · {item.ticker}</option>)}</select>}
      </header>
      {mapping && path.length ? (
        <>
          <div className="claim-horizon-strip">
            {horizons.map((item) => <span key={item} className={tone(mapping.returns[item].return)}><small>{horizonLabels[item]}</small><strong>{pct(mapping.returns[item].return)}</strong></span>)}
            <em>{security?.source || mapping.publicCheck?.priceSource || "public price"} · 基准日 = 100</em>
          </div>
          <div className="claim-price-chart">
            <ResponsiveContainer width="100%" height={390}>
              <LineChart data={path} margin={{ top: 30, right: 28, left: 4, bottom: 8 }}>
                <CartesianGrid stroke="#e1e4dd" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} minTickGap={20} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value, name, row) => name === "indexed" ? [`${Number(value).toFixed(1)} · 收盘 ${row.payload.close}`, "指数化价格"] : [value, name]} />
                <ReferenceArea x1={mapping.baseDate} x2={mapping.returns.t1.date || mapping.baseDate} fill="#e9c96b" fillOpacity=".19" label="T+0 → T+1" />
                <ReferenceArea x1={mapping.returns.t1.date || mapping.baseDate} x2={mapping.returns.t5.date || mapping.baseDate} fill="#5e91bc" fillOpacity=".10" label="T+1 → T+5" />
                <ReferenceLine x={mapping.baseDate} stroke="#c65e38" strokeWidth={2} label="Claim" />
                <ReferenceLine y={100} stroke="#9aa39d" strokeDasharray="4 4" />
                {horizons.map((item) => mapping.returns[item].date ? <ReferenceLine key={item} x={mapping.returns[item].date!} stroke="#8b948e" strokeDasharray="3 4" /> : null)}
                <Line type="monotone" dataKey="indexed" stroke="#205c48" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : <div className="claim-no-price">这条 Claim 暂无可发布的真实价格序列。</div>}
    </section>
  );
}
