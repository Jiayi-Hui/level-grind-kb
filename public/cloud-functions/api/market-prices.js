const json = (value, status = 200, cache = "no-store") => new Response(JSON.stringify(value), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cache,
  },
});

const symbolPattern = /^[A-Z0-9.^=-]{1,24}$/i;

async function fetchYahooSeries(symbol, interval = "1d") {
  const hourly = interval === "1h";
  const endpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${hourly ? "1mo" : "3mo"}&interval=${hourly ? "1h" : "1d"}&includePrePost=false&events=div%2Csplits`;
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 Level-Grind/1.0",
    },
  });
  if (!response.ok && !hourly) return fetchYahooSparkSeries(symbol, response.status);
  if (!response.ok) throw new Error(`Yahoo ${response.status}`);
  const body = await response.json();
  const result = body.chart?.result?.[0];
  if (!result || body.chart?.error) throw new Error(body.chart?.error?.description || "Yahoo 无可用数据");
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const closes = quote.close || [];
  const prices = timestamps.flatMap((timestamp, index) => {
    const close = Number(closes[index]);
    if (!Number.isFinite(close) || close <= 0) return [];
    return [{
      timestamp: new Date(timestamp * 1000).toISOString(),
      dateTime: new Date(timestamp * 1000).toISOString(),
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: Number.isFinite(Number(quote.open?.[index])) ? Number(quote.open[index]) : null,
      high: Number.isFinite(Number(quote.high?.[index])) ? Number(quote.high[index]) : null,
      low: Number.isFinite(Number(quote.low?.[index])) ? Number(quote.low[index]) : null,
      close,
      volume: Number.isFinite(Number(quote.volume?.[index])) ? Number(quote.volume[index]) : null,
      source: "Yahoo Finance",
    }];
  });
  return {
    symbol,
    currency: result.meta?.currency || null,
    exchange: result.meta?.exchangeName || null,
    interval: hourly ? "1h" : "1d",
    marketTimezone: result.meta?.exchangeTimezoneName || null,
    marketPrice: Number.isFinite(Number(result.meta?.regularMarketPrice)) ? Number(result.meta.regularMarketPrice) : null,
    marketTime: result.meta?.regularMarketTime ? new Date(result.meta.regularMarketTime * 1000).toISOString() : null,
    prices,
  };
}

async function fetchYahooSparkSeries(symbol, chartStatus = null) {
  // Yahoo's chart route intermittently rate-limits shared cloud egress while
  // its first-party Spark route continues to serve the same daily closes.
  // Keep this as a Yahoo-only fallback so the displayed provider and lineage
  // stay truthful rather than silently substituting another vendor.
  const endpoint = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(symbol)}&range=3mo&interval=1d`;
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 Level-Grind/1.0",
    },
  });
  if (!response.ok) throw new Error(`Yahoo ${response.status}${chartStatus ? ` (chart ${chartStatus})` : ""}`);
  const body = await response.json();
  const result = body?.[symbol];
  if (!result || result.error) throw new Error(result?.error?.description || "Yahoo Spark 无可用数据");
  const timestamps = result.timestamp || [];
  const closes = result.close || [];
  const prices = timestamps.flatMap((timestamp, index) => {
    const close = Number(closes[index]);
    if (!Number.isFinite(close) || close <= 0) return [];
    return [{
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      close,
      source: "Yahoo Finance",
    }];
  });
  if (!prices.length) throw new Error("Yahoo Spark 无可用价格");
  return {
    symbol,
    currency: null,
    exchange: null,
    marketPrice: prices.at(-1)?.close || null,
    marketTime: timestamps.at(-1) ? new Date(timestamps.at(-1) * 1000).toISOString() : null,
    prices,
  };
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const symbols = [...new Set((url.searchParams.get("symbols") || "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean))];
  if (!symbols.length) return json({ error: "至少需要一个 Yahoo symbol" }, 400);
  if (symbols.length > 10) return json({ error: "单次最多查询 10 个 symbol" }, 400);
  if (symbols.some((symbol) => !symbolPattern.test(symbol))) return json({ error: "symbol 格式不正确" }, 400);
  const interval = url.searchParams.get("interval") === "1h" ? "1h" : "1d";

  const settled = await Promise.allSettled(symbols.map((symbol) => fetchYahooSeries(symbol, interval)));
  const series = [];
  const errors = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") series.push(result.value);
    else errors.push({ symbol: symbols[index], error: result.reason instanceof Error ? result.reason.message : "Yahoo 查询失败" });
  });
  if (!series.length) return json({ error: "Yahoo Finance 暂时没有返回可用价格", errors }, 502);
  return json({
    provider: "Yahoo Finance",
    interval,
    generatedAt: new Date().toISOString(),
    series,
    errors,
  }, 200, "public, max-age=300, s-maxage=3600, stale-while-revalidate=300");
}
