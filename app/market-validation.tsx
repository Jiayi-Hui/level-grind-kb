"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type MarketPoint = { timestamp?: string; dateTime?: string; date: string; close: number };
type MarketSeries = { symbol: string; currency?: string | null; exchange?: string | null; interval?: string; marketTime?: string | null; prices: MarketPoint[] };

export function normalizeYahooSymbol(input: string) {
  const value = String(input || "").trim().toUpperCase();
  if (!value) return "";
  if (/^[A-Z0-9.^=-]+\.(HK|SS|SZ|TW|T)$/.test(value)) return value;
  const china = value.match(/^(\d{6})\s+(?:CH|CN)(?:\s+EQUITY)?$/);
  if (china) return `${china[1]}.${china[1].startsWith("6") ? "SS" : "SZ"}`;
  const hk = value.match(/^(\d{1,5})\s+HK(?:\s+EQUITY)?$/);
  if (hk) return `${hk[1].padStart(4, "0")}.HK`;
  const taiwan = value.match(/^(\d{4})\s+TT(?:\s+EQUITY)?$/);
  if (taiwan) return `${taiwan[1]}.TW`;
  const japan = value.match(/^([A-Z0-9]{4})\s+JP(?:\s+EQUITY)?$/);
  if (japan) return `${japan[1]}.T`;
  const us = value.match(/^([A-Z][A-Z0-9.^=-]{0,14})\s+US(?:\s+EQUITY)?$/);
  if (us) return us[1];
  return /^[A-Z0-9.^=-]{1,24}$/.test(value) ? value : "";
}

const pct = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;

export function MarketValidation({ ticker, startedAt, label = "价格验证" }: { ticker: string; startedAt?: string; label?: string }) {
  const symbol = useMemo(() => normalizeYahooSymbol(ticker), [ticker]);
  const [series, setSeries] = useState<MarketSeries | null>(null);
  const [generatedAt, setGeneratedAt] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");
  const effectiveStatus = symbol ? status : "idle";
  const effectiveMessage = symbol ? message : (ticker ? "请填写 Yahoo 可识别的 ticker。" : "填写 ticker 后自动开始价格验证。");

  useEffect(() => {
    if (!symbol) return;
    let active = true;
    const refresh = async () => {
      setStatus((current) => current === "ready" ? current : "loading");
      try {
        const response = await fetch(`/api/market-prices?symbols=${encodeURIComponent(symbol)}&interval=1h`, { cache: "no-store" });
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) throw new Error("当前预览未连接价格服务；生产环境将由 Yahoo Finance 每小时验证。");
        const payload = await response.json() as { generatedAt?: string; series?: MarketSeries[]; error?: string };
        if (!response.ok || !payload.series?.[0]) throw new Error(payload.error || "Yahoo Finance 暂无可用小时数据");
        if (!active) return;
        setSeries(payload.series[0]); setGeneratedAt(payload.generatedAt || new Date().toISOString()); setStatus("ready"); setMessage("");
      } catch (error) {
        if (!active) return;
        setStatus("error"); setMessage(error instanceof Error ? error.message : "价格验证暂时不可用");
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, [symbol, ticker]);

  const validation = useMemo(() => {
    const all = series?.symbol === symbol ? series.prices.filter((point) => Number.isFinite(point.close) && point.close > 0) : [];
    if (!all.length) return null;
    const startMs = startedAt ? Date.parse(startedAt) : Number.NaN;
    const scoped = Number.isFinite(startMs)
      ? all.filter((point) => Date.parse(point.timestamp || point.dateTime || `${point.date}T00:00:00Z`) >= startMs)
      : all;
    const points = scoped.length ? scoped : all.slice(-1);
    const base = points[0]; const latest = points.at(-1)!;
    const chart = points.map((point) => ({ ...point, label: new Date(point.timestamp || point.dateTime || point.date).toLocaleString("zh-HK", { month: "numeric", day: "numeric", hour: "2-digit" }), indexed: point.close / base.close * 100 }));
    const returns = points.map((point) => point.close / base.close - 1);
    return { base, latest, chart, latestReturn: latest.close / base.close - 1, upside: Math.max(...returns), downside: Math.min(...returns) };
  }, [series, startedAt, symbol]);

  return <section className="market-validation-card">
    <header><div><p className="eyebrow">MARKET VALIDATION</p><h4>{label}</h4></div><span>{symbol || "未配置 ticker"}</span></header>
    {effectiveStatus === "loading" && <p className="market-validation-state">正在读取 Yahoo Finance 小时数据…</p>}
    {(effectiveStatus === "idle" || effectiveStatus === "error") && <p className="market-validation-state">{effectiveMessage}</p>}
    {effectiveStatus === "ready" && validation && <>
      <div className="market-validation-metrics">
        <span><small>基准价</small><strong>{validation.base.close.toFixed(2)}</strong></span>
        <span><small>最新价</small><strong>{validation.latest.close.toFixed(2)}</strong></span>
        <span className={validation.latestReturn >= 0 ? "positive" : "negative"}><small>区间变化</small><strong>{pct(validation.latestReturn)}</strong></span>
        <span className="positive"><small>最大 Upside</small><strong>{pct(validation.upside)}</strong></span>
        <span className="negative"><small>最大 Downside</small><strong>{pct(validation.downside)}</strong></span>
      </div>
      <ResponsiveContainer width="100%" height={220}><LineChart data={validation.chart} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}><CartesianGrid stroke="#e2e5df" vertical={false} /><XAxis dataKey="label" minTickGap={34} tick={{ fontSize: 9 }} /><YAxis domain={["auto", "auto"]} tick={{ fontSize: 9 }} /><Tooltip formatter={(value, name, row) => name === "indexed" ? [`${Number(value).toFixed(1)} · ${row.payload.close.toFixed(2)}`, "基准=100"] : [value, name]} /><Line type="monotone" dataKey="indexed" stroke="#205c48" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer>
      <footer>Yahoo Finance · 1h · {generatedAt ? new Date(generatedAt).toLocaleString("zh-HK") : "—"} · 每小时重新验证</footer>
    </>}
    {effectiveStatus === "ready" && !validation && <p className="market-validation-state">该 ticker 暂无可验证小时数据。</p>}
  </section>;
}
