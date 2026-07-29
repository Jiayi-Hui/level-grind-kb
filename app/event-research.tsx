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

type HistoricalEvent = {
  event_id: string;
  event_date: string;
  event_name_cn: string;
  primary_shock: string;
  trigger: string;
  initial_market_narrative: string;
  demand_assessment: string;
  positioning_assessment: string;
  similarity_to_w29: number;
  is_negative_control: number;
  caveat: string | null;
  median_return_1d: NullableNumber;
  median_return_5d: NullableNumber;
  median_return_20d: NullableNumber;
  median_max_drawdown_20d: NullableNumber;
  negative_breadth_1d: NullableNumber;
};

type SectorReaction = {
  event_id: string;
  track_id: string;
  track_name_cn: string;
  median_return_1d: NullableNumber;
};

type SecurityReaction = {
  event_id: string;
  ticker: string;
  role: string;
  name_cn: string;
  name_en: string;
  market: string;
  return_1d: NullableNumber;
  return_5d: NullableNumber;
  return_20d: NullableNumber;
  abnormal_1d: NullableNumber;
  pre_20d_return: NullableNumber;
  event_volume_vs_prior20_median: NullableNumber;
};

type PricePathPoint = {
  event_id: string;
  session: number;
  median_return: NullableNumber;
  median_abnormal: NullableNumber;
  security_count: number;
};

type SourceRecord = {
  source_id: string;
  event_id: string;
  publisher: string;
  published_date: string;
  title: string;
  url: string;
};

type EventResearchPayload = {
  publishedAt: string;
  events: HistoricalEvent[];
  sectorSummaries: SectorReaction[];
  eventReturns: SecurityReaction[];
  eventPricePaths: PricePathPoint[];
  sources: SourceRecord[];
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

const shockLabels: Record<string, string> = {
  valuation_roi: "估值 / ROI",
  earnings_expectation: "财报 / 预期",
  macro_liquidity: "宏观 / 流动性",
  policy: "政策",
  efficiency_narrative: "效率 / 需求叙事",
  demand_inventory: "订单 / 库存",
  orders_guidance: "订单 / 指引",
};

const demandLabels: Record<string, string> = {
  demand_intact: "需求仍强",
  ai_intact_non_ai_weak: "AI 强 / 非 AI 弱",
  uncertain_demand: "需求待验证",
  actual_deterioration: "基本面恶化",
  policy_impaired: "政策受损",
};

function pct(value: NullableNumber, signed = true) {
  if (value === null || Number.isNaN(value)) return "—";
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function tone(value: NullableNumber) {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

function exactDate(value?: string) {
  return value?.slice(0, 10).replaceAll("-", ".") || "—";
}

function eventQuarter(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return `${date.getUTCFullYear()}Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

function median(values: NullableNumber[]) {
  const valid = values
    .filter((value): value is number => value !== null && !Number.isNaN(value))
    .sort((a, b) => a - b);
  if (!valid.length) return null;
  const middle = Math.floor(valid.length / 2);
  return valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
}

function investmentReadThrough(event: HistoricalEvent) {
  if (event.demand_assessment === "actual_deterioration") {
    return {
      stance: "防守 / 等待验证",
      title: "不要把基本面恶化误判为单纯拥挤交易出清",
      body: "历史上当订单、库存或指引同步转弱时，首日反弹并不能确认见底。仓位应等待领先指标、盈利预期和成交结构至少有一项转折。",
      watch: "验证：订单与库存拐点、盈利预测下修是否停止、T+5 至 T+20 是否仍跑输基准。",
    };
  }
  if (event.demand_assessment === "policy_impaired") {
    return {
      stance: "降低政策暴露",
      title: "政策冲击的持续时间通常长于单日价格反应",
      body: "优先区分一次性风险溢价与真实收入/供应链受限。配置上更适合转向替代供应商、受益地区或政策暴露更低的环节。",
      watch: "验证：规则执行范围、许可证节奏、客户转单和本地替代份额。",
    };
  }
  if (event.demand_assessment === "demand_intact" || event.demand_assessment === "ai_intact_non_ai_weak") {
    return {
      stance: "分化买入 / 避免追涨",
      title: "若需求未坏，价格下跌更可能是估值和仓位再平衡",
      body: "历史路径支持在确认订单与资本开支仍强后，优先回补盈利兑现度高、估值回撤充分的龙头，而不是无差别抄底整个主题。",
      watch: "验证：AI 订单、资本开支、交付瓶颈与盈利上修是否延续；若 T+5 仍显著跑输基准则下调判断。",
    };
  }
  return {
    stance: "小仓位观察",
    title: "当前证据不足以把价格波动归因于需求或仓位",
    body: "先把市场叙事拆成可验证变量，再决定是否扩大风险。该结论用于研究排序，不是自动交易指令。",
    watch: "验证：公司指引、供应链交叉信息、分析师预期变化与后续价格广度。",
  };
}

export function EventResearch({
  liveClaims,
  onAsk,
}: {
  liveClaims: LiveClaim[];
  onAsk: (title: string, detail: string) => void;
}) {
  const [data, setData] = useState<EventResearchPayload | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [shock, setShock] = useState("all");
  const [demand, setDemand] = useState("all");
  const [quarter, setQuarter] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [company, setCompany] = useState("all");
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/data/event-research.json", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("历史事件数据暂时不可用");
        return response.json() as Promise<EventResearchPayload>;
      })
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setSelectedId((current) => current || payload.events[0]?.event_id || "");
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "历史事件数据暂时不可用");
      });
    return () => {
      active = false;
    };
  }, []);

  const filters = useMemo(() => {
    if (!data) return { shocks: [], demands: [], quarters: [], industries: [], companies: [] };
    const companies = data.eventReturns
      .filter((row) => row.role === "asia_core")
      .map((row) => ({ value: row.ticker, label: `${row.name_cn || row.name_en} · ${row.ticker}` }))
      .filter((item, index, rows) => rows.findIndex((row) => row.value === item.value) === index)
      .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
    return {
      shocks: [...new Set(data.events.map((event) => event.primary_shock))].sort(),
      demands: [...new Set(data.events.map((event) => event.demand_assessment))].sort(),
      quarters: [...new Set(data.events.map((event) => eventQuarter(event.event_date)))].sort().reverse(),
      industries: [...new Set(data.sectorSummaries.map((row) => row.track_name_cn))]
        .sort((a, b) => a.localeCompare(b, "zh-CN")),
      companies,
    };
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = search.trim().toLocaleLowerCase("zh-CN");
    return data.events.filter((event) => {
      const related = data.eventReturns
        .filter((row) => row.event_id === event.event_id)
        .flatMap((row) => [row.ticker, row.name_cn, row.name_en]);
      const matchesSearch = !needle || [
        event.event_name_cn,
        event.trigger,
        event.initial_market_narrative,
        event.positioning_assessment,
        ...related,
      ].some((value) => value?.toLocaleLowerCase("zh-CN").includes(needle));
      return matchesSearch
        && (shock === "all" || event.primary_shock === shock)
        && (demand === "all" || event.demand_assessment === demand)
        && (quarter === "all" || eventQuarter(event.event_date) === quarter)
        && (industry === "all" || data.sectorSummaries.some(
          (row) => row.event_id === event.event_id && row.track_name_cn === industry,
        ))
        && (company === "all" || data.eventReturns.some(
          (row) => row.event_id === event.event_id && row.ticker === company,
        ));
    });
  }, [company, data, demand, industry, quarter, search, shock]);

  const selected = filtered.find((event) => event.event_id === selectedId) || filtered[0];
  const filteredReadThrough = useMemo(() => {
    const t1 = median(filtered.map((event) => event.median_return_1d));
    const t5 = median(filtered.map((event) => event.median_return_5d));
    const t20 = median(filtered.map((event) => event.median_return_20d));
    const intact = filtered.filter((event) => (
      event.demand_assessment === "demand_intact" || event.demand_assessment === "ai_intact_non_ai_weak"
    )).length;
    const impaired = filtered.filter((event) => (
      event.demand_assessment === "actual_deterioration" || event.demand_assessment === "policy_impaired"
    )).length;
    const stance = !filtered.length
      ? "没有足够样本"
      : impaired > intact
        ? "先降低风险暴露，等待基本面或政策证据反转"
        : (t20 || 0) > 0
          ? "优先研究回撤充分、盈利兑现度高的龙头"
          : "保持选择性，避免把主题回撤直接视为买点";
    return { t1, t5, t20, intact, stance };
  }, [filtered]);

  if (error) return <div className="empty-state"><h3>{error}</h3><p>请检查事件研究快照是否已随版本发布。</p></div>;
  if (!data) return <div className="event-research-loading"><i className="button-spinner" /> 正在载入事件与价格路径…</div>;

  return (
    <div className="event-research-shell">
      <section className="live-claim-band" aria-live="polite">
        <div className="live-claim-heading">
          <div>
            <span className="live-dot" />
            <strong>WeChat → Codex 实时 Claim Inbox</strong>
          </div>
          <small>{liveClaims.length} 条 · 每 3 秒刷新</small>
        </div>
        <div className="live-claim-list">
          {liveClaims.slice(0, 3).map((claim) => (
            <article key={claim.id}>
              <span>{exactDate(claim.claimed_at)} · {claim.speaker || "WeChat Group"}</span>
              <strong>{claim.company || claim.ticker || "待识别主体"}</strong>
              <p>{claim.claim_text}</p>
            </article>
          ))}
          {!liveClaims.length && <p className="live-empty">等待从 WeChat Bot 进入的第一条 Claim。</p>}
        </div>
      </section>

      <section className="event-research-intro">
        <div>
          <p className="eyebrow">EVENT RESEARCH</p>
          <h2>历史事件、价格路径与投资含义</h2>
          <p>不是只记录“发生了什么”，而是比较相似事件后市场如何定价，并把判断拆成可验证条件。</p>
        </div>
        <div className="event-research-count">
          <strong>{data.events.length}</strong>
          <span>个历史事件</span>
        </div>
      </section>

      <section className="event-research-filters" aria-label="跨事件搜索与分类">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="跨事件搜索：主题、触发因素、公司或股票代码"
          aria-label="跨事件搜索"
        />
        <select value={shock} onChange={(event) => setShock(event.target.value)} aria-label="冲击类型">
          <option value="all">全部冲击类型</option>
          {filters.shocks.map((value) => <option key={value} value={value}>{shockLabels[value] || value}</option>)}
        </select>
        <select value={demand} onChange={(event) => setDemand(event.target.value)} aria-label="需求判断">
          <option value="all">全部需求判断</option>
          {filters.demands.map((value) => <option key={value} value={value}>{demandLabels[value] || value}</option>)}
        </select>
        <select value={company} onChange={(event) => setCompany(event.target.value)} aria-label="公司">
          <option value="all">全部公司</option>
          {filters.companies.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select value={industry} onChange={(event) => setIndustry(event.target.value)} aria-label="行业">
          <option value="all">全部行业</option>
          {filters.industries.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={quarter} onChange={(event) => setQuarter(event.target.value)} aria-label="季度">
          <option value="all">全部季度</option>
          {filters.quarters.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </section>

      <section className="cross-event-readthrough" aria-label="跨事件投资映射">
        <div>
          <span>当前筛选 · {filtered.length} 个事件</span>
          <strong>{filteredReadThrough.stance}</strong>
          <small>{filteredReadThrough.intact} 个样本显示需求仍强或 AI 需求与非 AI 分化；结论随筛选条件动态变化。</small>
        </div>
        <dl>
          <div><dt>T+1 中位数</dt><dd className={tone(filteredReadThrough.t1)}>{pct(filteredReadThrough.t1)}</dd></div>
          <div><dt>T+5 中位数</dt><dd className={tone(filteredReadThrough.t5)}>{pct(filteredReadThrough.t5)}</dd></div>
          <div><dt>T+20 中位数</dt><dd className={tone(filteredReadThrough.t20)}>{pct(filteredReadThrough.t20)}</dd></div>
        </dl>
      </section>

      <div className="event-research-index">
        {filtered.map((event) => (
          <button
            key={event.event_id}
            className={selected?.event_id === event.event_id ? "selected" : ""}
            onClick={() => setSelectedId(event.event_id)}
          >
            <span>{exactDate(event.event_date)}</span>
            <strong>{event.event_name_cn}</strong>
            <em>{shockLabels[event.primary_shock] || event.primary_shock}</em>
            <b className={tone(event.median_return_1d)}>{pct(event.median_return_1d)}</b>
            <b className={tone(event.median_return_5d)}>{pct(event.median_return_5d)}</b>
            <b className={tone(event.median_return_20d)}>{pct(event.median_return_20d)}</b>
          </button>
        ))}
        {!filtered.length && <div className="live-empty">没有匹配的事件，请减少筛选条件。</div>}
      </div>

      {selected && (
        <EventResearchDetail
          event={selected}
          data={data}
          onAsk={() => onAsk(
            selected.event_name_cn,
            `${selected.trigger}；历史 T+1 ${pct(selected.median_return_1d)}、T+5 ${pct(selected.median_return_5d)}、T+20 ${pct(selected.median_return_20d)}。`,
          )}
        />
      )}
    </div>
  );
}

function EventResearchDetail({
  event,
  data,
  onAsk,
}: {
  event: HistoricalEvent;
  data: EventResearchPayload;
  onAsk: () => void;
}) {
  const pricePath = data.eventPricePaths
    .filter((row) => row.event_id === event.event_id)
    .map((row) => ({
      session: `T+${row.session}`,
      raw: row.median_return === null ? null : row.median_return * 100,
      abnormal: row.median_abnormal === null ? null : row.median_abnormal * 100,
      count: row.security_count,
    }));
  const sectors = data.sectorSummaries
    .filter((row) => row.event_id === event.event_id)
    .sort((a, b) => (a.median_return_1d || 0) - (b.median_return_1d || 0))
    .map((row) => ({ name: row.track_name_cn, value: row.median_return_1d === null ? null : row.median_return_1d * 100 }));
  const securities = data.eventReturns
    .filter((row) => row.event_id === event.event_id && row.role === "asia_core")
    .sort((a, b) => (a.return_1d || 0) - (b.return_1d || 0));
  const sources = data.sources.filter((source) => source.event_id === event.event_id);
  const readThrough = investmentReadThrough(event);

  return (
    <section className="event-research-detail">
      <header>
        <div>
          <span className="eyebrow">{exactDate(event.event_date)} · {shockLabels[event.primary_shock] || event.primary_shock}</span>
          <h2>{event.event_name_cn}</h2>
        </div>
        <button className="ask-context-button" onClick={onAsk}>✦ 用 AskAI 深入研究</button>
      </header>

      <div className="event-reaction-strip">
        {[
          ["T+1", event.median_return_1d],
          ["T+5", event.median_return_5d],
          ["T+20", event.median_return_20d],
          ["20日最大回撤", event.median_max_drawdown_20d],
        ].map(([label, value]) => (
          <article key={String(label)} className={tone(value as NullableNumber)}>
            <span>{label}</span>
            <strong>{pct(value as NullableNumber)}</strong>
          </article>
        ))}
        <article>
          <span>首日下跌股票占比</span>
          <strong>{pct(event.negative_breadth_1d, false)}</strong>
        </article>
      </div>

      <div className="event-thesis-grid">
        <article><span>触发因素</span><p>{event.trigger}</p></article>
        <article><span>市场最初如何理解</span><p>{event.initial_market_narrative}</p></article>
        <article><span>需求判断</span><p>{demandLabels[event.demand_assessment] || event.demand_assessment}</p></article>
        <article><span>仓位判断</span><p>{event.positioning_assessment}</p></article>
      </div>

      <section className="investment-readthrough">
        <div>
          <span>投资含义 · {readThrough.stance}</span>
          <h3>{readThrough.title}</h3>
        </div>
        <p>{readThrough.body}</p>
        <small>{readThrough.watch}</small>
        <em>研究辅助，不构成自动买卖指令。</em>
      </section>

      <div className="event-chart-grid">
        <section>
          <div className="event-chart-heading"><h3>事件后股价路径</h3><span>亚洲核心股票中位数</span></div>
          <div className="event-chart-frame">
            <ResponsiveContainer width="100%" height={310}>
              <LineChart data={pricePath} margin={{ top: 18, right: 20, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="#dde4df" strokeDasharray="2 3" vertical={false} />
                <ReferenceLine y={0} stroke="#87958d" strokeDasharray="4 4" />
                <XAxis dataKey="session" tick={{ fill: "#65736c", fontSize: 11 }} interval={pricePath.length > 10 ? 1 : 0} />
                <YAxis unit="%" width={48} tick={{ fill: "#65736c", fontSize: 11 }} />
                <Tooltip formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name === "raw" ? "绝对收益" : "相对本地基准"]} />
                <Legend formatter={(value) => value === "raw" ? "绝对收益" : "相对本地基准"} />
                <Line type="monotone" dataKey="raw" stroke="#173d32" strokeWidth={2.6} dot={{ r: 2 }} connectNulls />
                <Line type="monotone" dataKey="abnormal" stroke="#ce5a32" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section>
          <div className="event-chart-heading"><h3>赛道首日反应</h3><span>等权中位数</span></div>
          <div className="event-chart-frame">
            <ResponsiveContainer width="100%" height={310}>
              <BarChart data={sectors} layout="vertical" margin={{ top: 8, right: 20, bottom: 8, left: 8 }}>
                <CartesianGrid stroke="#dde4df" strokeDasharray="2 3" horizontal={false} />
                <XAxis type="number" unit="%" tick={{ fill: "#65736c", fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={112} tick={{ fill: "#34433c", fontSize: 11 }} />
                <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                <Bar dataKey="value" name="T+1" fill="#315f52" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="event-bottom-grid">
        <section>
          <div className="event-chart-heading"><h3>个股反应</h3><span>{securities.length} 只亚洲核心股票</span></div>
          <div className="event-security-table">
            <table>
              <thead><tr><th>股票</th><th>T+1</th><th>T+5</th><th>T+20</th><th>首日超额</th></tr></thead>
              <tbody>
                {securities.map((row) => (
                  <tr key={row.ticker}>
                    <td><strong>{row.name_cn}</strong><small>{row.ticker}</small></td>
                    <td className={tone(row.return_1d)}>{pct(row.return_1d)}</td>
                    <td className={tone(row.return_5d)}>{pct(row.return_5d)}</td>
                    <td className={tone(row.return_20d)}>{pct(row.return_20d)}</td>
                    <td className={tone(row.abnormal_1d)}>{pct(row.abnormal_1d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <div className="event-chart-heading"><h3>证据来源</h3><span>{sources.length} 条</span></div>
          <div className="event-source-list">
            {sources.map((source) => (
              <a href={source.url} target="_blank" rel="noreferrer" key={source.source_id}>
                <span>{source.publisher} · {exactDate(source.published_date)}</span>
                <strong>{source.title}</strong>
              </a>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
