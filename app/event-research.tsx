"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type NullableNumber = number | null;

type Horizon = {
  date: string | null;
  close: NullableNumber;
  return: NullableNumber;
  abnormal: NullableNumber;
  benchmarkClose: NullableNumber;
};

type ClaimMapping = {
  mappingType: string;
  ticker: string;
  security: string;
  market: string;
  benchmark: string;
  mappingRationale: string;
  eventSession: string;
  baseDate: string;
  baseClose: NullableNumber;
  status: string;
  returns: {
    t0: Horizon;
    t1: Horizon;
    t3: Horizon;
    t5: Horizon;
  };
  publicCheck: {
    status: string;
    priceSource: string;
    benchmarkSource: string;
    abnormalDiffBp: Record<"t0" | "t1" | "t3" | "t5", NullableNumber>;
  } | null;
  publicSymbol: string | null;
};

type VerificationEvidence = {
  findingId: string;
  verificationStatus: string;
  nextEvidenceNeeded: string[];
  bbgEvidence: Array<{
    ticker: string;
    date: string;
    field: string;
    value: string;
  }>;
  dymonEvidence: Array<{
    sourceType: string;
    title: string;
    date: string;
    publisher?: string;
    note: string;
  }>;
};

type LedgerClaim = {
  claimDateStart: string;
  claimDateEnd: string | null;
  claimTimeHkt: string | null;
  dateEvidenceType: string;
  dateConfidence: string;
  claimId: string;
  eventId: string;
  sourceWeek: string | null;
  speaker: string | null;
  entity: string | null;
  title: string;
  originalClaim: string;
  claimConfidence: string | null;
  verificationStatus: string | null;
  effectivePeriod: string | null;
  needsOriginalTimestamp: boolean;
  contentStatus: string | null;
  priceStatus: string;
  verificationEvidence: VerificationEvidence[];
  mappings: ClaimMapping[];
};

type SecuritySeries = {
  ticker: string;
  publicSymbol: string | null;
  source: string | null;
  prices: Array<{
    date: string;
    close: number;
    source: string;
    publicSymbol: string;
  }>;
};

type ClaimLedgerPayload = {
  schemaVersion: string;
  generatedAt: string;
  dataCutoff: string;
  recordCounts: {
    claims: number;
    exactTimestampClaims: number;
    mappedClaims: number;
    claimSecurityMappings: number;
    securitiesWithPublicPrices: number;
    verificationFindings: number;
  };
  methodology: {
    contentBoundary: string;
    bbgBoundary: string;
    publicBoundary: string;
    horizons: string[];
  };
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

const horizonKeys = ["t0", "t1", "t3", "t5"] as const;
const horizonLabels = { t0: "T+0", t1: "T+1", t3: "T+3", t5: "T+5" };

function pct(value: NullableNumber, digits = 1) {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value > 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;
}

function tone(value: NullableNumber) {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

function dateLabel(claim: LedgerClaim) {
  const end = claim.claimDateEnd && claim.claimDateEnd !== claim.claimDateStart
    ? ` – ${claim.claimDateEnd}`
    : "";
  const time = claim.claimTimeHkt ? ` ${claim.claimTimeHkt}` : "";
  return `${claim.claimDateStart}${end}${time}`;
}

function contentStatusTone(claim: LedgerClaim) {
  if (claim.verificationEvidence.length) return "evidence";
  if (claim.verificationStatus?.includes("未验证")) return "unverified";
  return "pending";
}

function mappingMedian(claim: LedgerClaim, key: keyof ClaimMapping["returns"]) {
  const values = claim.mappings
    .map((mapping) => mapping.returns[key].return)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

export function EventResearch({
  liveClaims,
  onAsk,
}: {
  liveClaims: LiveClaim[];
  onAsk: (title: string, detail: string) => void;
}) {
  const [data, setData] = useState<ClaimLedgerPayload | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [speaker, setSpeaker] = useState("all");
  const [evidence, setEvidence] = useState("all");
  const [mappingType, setMappingType] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/data/claim-ledger-dashboard.json", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Claim ledger 暂时不可用");
        return response.json() as Promise<ClaimLedgerPayload>;
      })
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setSelectedId(payload.claims[0]?.claimId || "");
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Claim ledger 暂时不可用");
      });
    return () => {
      active = false;
    };
  }, []);

  const filters = useMemo(() => {
    if (!data) return { speakers: [], mappingTypes: [] };
    return {
      speakers: [...new Set(data.claims.map((claim) => claim.speaker).filter(Boolean) as string[])]
        .sort((a, b) => a.localeCompare(b, "zh-CN")),
      mappingTypes: [...new Set(data.claims.flatMap((claim) => claim.mappings.map((mapping) => mapping.mappingType)))]
        .sort(),
    };
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = search.trim().toLocaleLowerCase("zh-CN");
    return data.claims.filter((claim) => {
      const text = [
        claim.title,
        claim.originalClaim,
        claim.entity,
        claim.speaker,
        claim.eventId,
        ...claim.mappings.flatMap((mapping) => [mapping.ticker, mapping.security]),
      ].filter(Boolean).join(" ").toLocaleLowerCase("zh-CN");
      const evidenceMatch = evidence === "all"
        || (evidence === "source" && claim.verificationEvidence.length > 0)
        || (evidence === "timestamp" && claim.dateEvidenceType === "原始群聊时间戳")
        || (evidence === "pending" && claim.verificationEvidence.length === 0);
      return (!needle || text.includes(needle))
        && (speaker === "all" || claim.speaker === speaker)
        && evidenceMatch
        && (mappingType === "all" || claim.mappings.some((mapping) => mapping.mappingType === mappingType));
    });
  }, [data, evidence, mappingType, search, speaker]);

  const selected = filtered.find((claim) => claim.claimId === selectedId) || filtered[0] || null;
  const comparedClaims = useMemo(
    () => (data?.claims || []).filter((claim) => compareIds.includes(claim.claimId)),
    [compareIds, data],
  );

  const toggleCompare = (claimId: string) => {
    setCompareIds((current) => current.includes(claimId)
      ? current.filter((id) => id !== claimId)
      : current.length >= 4
        ? [...current.slice(1), claimId]
        : [...current, claimId]);
  };

  if (error) return <div className="empty-state"><h3>{error}</h3><p>请重新生成并发布真实 Claim ledger 快照。</p></div>;
  if (!data) return <div className="event-research-loading"><i className="button-spinner" /> 正在载入 Claim 与价格事件窗…</div>;

  return (
    <div className="claim-ledger-shell">
      {liveClaims.length > 0 && (
        <section className="live-claim-band" aria-live="polite">
          <div className="live-claim-heading">
            <div><span className="live-dot" /><strong>新进入的 Claim</strong></div>
            <small>{liveClaims.length} 条</small>
          </div>
          <div className="live-claim-list">
            {liveClaims.slice(0, 3).map((claim) => (
              <article key={claim.id}>
                <span>{claim.claimed_at?.slice(0, 16).replace("T", " ") || "时间待补"} · {claim.speaker || "发言人待补"}</span>
                <strong>{claim.company || claim.ticker || "主体待识别"}</strong>
                <p>{claim.claim_text}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="claim-ledger-kpis" aria-label="Claim ledger coverage">
        <article><span>群聊 Claims</span><strong>{data.recordCounts.claims}</strong></article>
        <article><span>原始时间戳</span><strong>{data.recordCounts.exactTimestampClaims}</strong></article>
        <article><span>证券映射</span><strong>{data.recordCounts.claimSecurityMappings}</strong></article>
        <article><span>公开价格覆盖</span><strong>{data.recordCounts.securitiesWithPublicPrices}/48</strong></article>
        <article><span>数据截至</span><strong>{data.dataCutoff.slice(0, 10)}</strong></article>
      </section>

      <section className="claim-ledger-toolbar" aria-label="Claim filters">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索 Claim、公司、发言人或股票代码"
          aria-label="搜索 Claim"
        />
        <select value={speaker} onChange={(event) => setSpeaker(event.target.value)} aria-label="发言人">
          <option value="all">全部发言人</option>
          {filters.speakers.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={evidence} onChange={(event) => setEvidence(event.target.value)} aria-label="证据状态">
          <option value="all">全部证据状态</option>
          <option value="source">有 BBG / Dymon 核验材料</option>
          <option value="timestamp">有原始群聊时间戳</option>
          <option value="pending">内容待核验</option>
        </select>
        <select value={mappingType} onChange={(event) => setMappingType(event.target.value)} aria-label="证券映射">
          <option value="all">全部证券映射</option>
          {filters.mappingTypes.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </section>

      {comparedClaims.length > 1 && (
        <CrossClaimComparison claims={comparedClaims} onClear={() => setCompareIds([])} />
      )}

      <div className="claim-ledger-layout">
        <section className="claim-ledger-list" aria-label="Claims">
          <header><strong>{filtered.length} 条</strong><span>最多比较 4 条</span></header>
          {filtered.map((claim) => (
            <article
              key={claim.claimId}
              className={selected?.claimId === claim.claimId ? "claim-ledger-row selected" : "claim-ledger-row"}
            >
              <button className="claim-ledger-open" onClick={() => setSelectedId(claim.claimId)}>
                <span>{dateLabel(claim)} · {claim.speaker || "发言人待补"}</span>
                <strong>{claim.title}</strong>
                <small>{claim.entity} · {claim.mappings.length} 个证券映射</small>
              </button>
              <label className="claim-compare-toggle">
                <input
                  type="checkbox"
                  checked={compareIds.includes(claim.claimId)}
                  onChange={() => toggleCompare(claim.claimId)}
                />
                比较
              </label>
            </article>
          ))}
          {!filtered.length && <div className="live-empty">没有匹配的 Claim。</div>}
        </section>

        <section className="claim-ledger-detail">
          {selected ? (
            <ClaimDetail
              key={selected.claimId}
              claim={selected}
              securities={data.securities}
              methodology={data.methodology}
              onAsk={() => onAsk(selected.title, selected.originalClaim)}
            />
          ) : (
            <div className="empty-state"><h3>选择一条 Claim</h3></div>
          )}
        </section>
      </div>
    </div>
  );
}

function CrossClaimComparison({
  claims,
  onClear,
}: {
  claims: LedgerClaim[];
  onClear: () => void;
}) {
  return (
    <section className="claim-comparison">
      <header><div><span>跨 Claim 比较</span><strong>{claims.length} 条</strong></div><button onClick={onClear}>清除</button></header>
      <div className="claim-comparison-grid">
        <span>Claim</span><span>T+0</span><span>T+1</span><span>T+3</span><span>T+5</span>
        {claims.map((claim) => (
          <div className="claim-comparison-row" key={claim.claimId}>
            <strong>{claim.title}</strong>
            {horizonKeys.map((key) => {
              const value = mappingMedian(claim, key);
              return <b key={key} className={tone(value)}>{pct(value)}</b>;
            })}
          </div>
        ))}
      </div>
      <small>中位数基于该 Claim 的已映射证券；直接映射与代理篮子请在详情中分别查看。</small>
    </section>
  );
}

function ClaimDetail({
  claim,
  securities,
  methodology,
  onAsk,
}: {
  claim: LedgerClaim;
  securities: SecuritySeries[];
  methodology: ClaimLedgerPayload["methodology"];
  onAsk: () => void;
}) {
  const [ticker, setTicker] = useState(claim.mappings[0]?.ticker || "");

  const mapping = claim.mappings.find((row) => row.ticker === ticker) || claim.mappings[0] || null;
  const security = securities.find((row) => row.ticker === mapping?.ticker);
  const pricePath = useMemo(() => {
    if (!security?.prices.length || !mapping?.baseDate || !mapping.baseClose) return [];
    return security.prices
      .filter((point) => point.date >= mapping.baseDate)
      .map((point) => ({
        date: point.date.slice(5),
        fullDate: point.date,
        indexed: (point.close / mapping.baseClose!) * 100,
        close: point.close,
      }));
  }, [mapping, security]);
  const returnBars = mapping ? horizonKeys.map((key) => ({
    horizon: horizonLabels[key],
    return: mapping.returns[key].return === null ? null : mapping.returns[key].return! * 100,
    abnormal: mapping.returns[key].abnormal === null ? null : mapping.returns[key].abnormal! * 100,
    date: mapping.returns[key].date,
  })) : [];

  return (
    <>
      <header className="claim-detail-heading">
        <div>
          <div className="claim-detail-tags">
            <span className={`claim-content-status ${contentStatusTone(claim)}`}>{claim.contentStatus || "待核验"}</span>
            <span>{claim.dateEvidenceType} · {claim.dateConfidence}可信度</span>
            {claim.mappings.length > 0 && <span>BBG 价格事件窗</span>}
          </div>
          <h2>{claim.title}</h2>
          <p>{claim.entity} · {dateLabel(claim)} · {claim.speaker || "发言人待补"}</p>
        </div>
        <button className="ask-context-button" onClick={onAsk}>询问此 Claim</button>
      </header>

      <blockquote className="claim-original">
        <span>WeChat Group 原始口径</span>
        {claim.originalClaim}
      </blockquote>

      <dl className="claim-fact-grid">
        <div><dt>Claim ID</dt><dd>{claim.claimId}</dd></div>
        <div><dt>事件 / 预测期</dt><dd>{claim.effectivePeriod || "—"}</dd></div>
        <div><dt>内容核验</dt><dd>{claim.verificationStatus || "待核验"}</dd></div>
        <div><dt>价格核验</dt><dd>{claim.priceStatus}</dd></div>
      </dl>

      {mapping ? (
        <>
          <section className="claim-price-header">
            <div><span>价格反应</span><strong>{mapping.security}</strong><small>{mapping.ticker} · 基准 {mapping.benchmark}</small></div>
            <select value={mapping.ticker} onChange={(event) => setTicker(event.target.value)} aria-label="选择证券">
              {claim.mappings.map((row) => (
                <option key={row.ticker} value={row.ticker}>{row.security} · {row.mappingType}</option>
              ))}
            </select>
          </section>

          <div className="claim-chart-grid">
            <article className="claim-chart-card">
              <header><strong>事件窗收益</strong><span>收益 / 相对基准</span></header>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={returnBars} margin={{ top: 18, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#e1e4dd" vertical={false} />
                  <XAxis dataKey="horizon" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `${value}%`} />
                  <Tooltip
                    formatter={(value, name) => [`${Number(value).toFixed(2)}%`, name === "return" ? "收益" : "相对基准"]}
                    labelFormatter={(label, rows) => `${label}${rows?.[0]?.payload?.date ? ` · ${rows[0].payload.date}` : ""}`}
                  />
                  <Legend formatter={(value) => value === "return" ? "收益" : "相对基准"} />
                  <ReferenceLine y={0} stroke="#7c8982" />
                  <Bar dataKey="return" fill="#2d6854" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="abnormal" fill="#6f94b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </article>

            <article className="claim-chart-card">
              <header><strong>公开价格路径</strong><span>基准日 = 100</span></header>
              {pricePath.length ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={pricePath} margin={{ top: 18, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="#e1e4dd" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} minTickGap={20} />
                    <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                    <Tooltip
                      formatter={(value, name, row) => [
                        name === "indexed" ? Number(value).toFixed(1) : value,
                        name === "indexed" ? `指数化 · 收盘 ${row.payload.close}` : name,
                      ]}
                      labelFormatter={(_, rows) => rows?.[0]?.payload?.fullDate || ""}
                    />
                    <ReferenceLine y={100} stroke="#b7bdb9" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="indexed" stroke="#2d6854" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div className="live-empty">该证券没有可发布的公开价格路径。</div>}
            </article>
          </div>

          <section className="claim-mapping-table-wrap">
            <table className="claim-mapping-table">
              <thead>
                <tr><th>证券</th><th>映射</th><th>T+0</th><th>T+1</th><th>T+3</th><th>T+5</th><th>公开复核</th></tr>
              </thead>
              <tbody>
                {claim.mappings.map((row) => (
                  <tr key={row.ticker} className={row.ticker === mapping.ticker ? "selected" : ""} onClick={() => setTicker(row.ticker)}>
                    <td><strong>{row.security}</strong><small>{row.ticker}</small></td>
                    <td>{row.mappingType}</td>
                    {horizonKeys.map((key) => <td key={key} className={tone(row.returns[key].return)}>{pct(row.returns[key].return)}</td>)}
                    <td>{row.publicCheck?.status === "ok" ? `${row.publicCheck.priceSource} ✓` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : (
        <div className="empty-state"><h3>没有证券映射</h3><p>该 Claim 尚未建立可审计的价格事件窗。</p></div>
      )}

      <section className="claim-evidence-section">
        <header><strong>核验材料</strong><span>{claim.verificationEvidence.length ? `${claim.verificationEvidence.length} 组` : "内容仍待核验"}</span></header>
        {claim.verificationEvidence.length ? claim.verificationEvidence.map((finding) => (
          <article key={finding.findingId}>
            <div className="claim-evidence-id">{finding.findingId} · {finding.verificationStatus}</div>
            <div className="claim-evidence-grid">
              {finding.bbgEvidence.map((item) => (
                <div key={`${item.ticker}-${item.date}-${item.field}`}>
                  <span>Bloomberg Desktop</span>
                  <strong>{item.ticker}</strong>
                  <p>{item.date} · {item.field} · {item.value}</p>
                </div>
              ))}
              {finding.dymonEvidence.map((item) => (
                <div key={`${item.title}-${item.date}`}>
                  <span>{item.publisher || "Dymon MCP"} · {item.sourceType}</span>
                  <strong>{item.title}</strong>
                  <p>{item.date} · {item.note}</p>
                </div>
              ))}
            </div>
            {finding.nextEvidenceNeeded?.length > 0 && (
              <p className="claim-next-evidence">仍需：{finding.nextEvidenceNeeded.join("；")}</p>
            )}
          </article>
        )) : (
          <p className="live-empty">目前只有群聊来源和价格事件窗；它们不能证明 Claim 内容本身成立。</p>
        )}
      </section>

      <footer className="claim-method-note">
        <strong>数据边界</strong>
        <span>{methodology.contentBoundary}</span>
        <span>{methodology.bbgBoundary}</span>
        <span>{methodology.publicBoundary}</span>
      </footer>
    </>
  );
}
