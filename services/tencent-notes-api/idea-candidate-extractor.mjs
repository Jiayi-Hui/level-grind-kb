const MAX_CANDIDATES = 12;

function text(value, max = 240) {
  return String(value || "").replace(/\u0000/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function lines(value) {
  return String(value || "").replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean);
}

function labeled(block, labels, max = 180) {
  const expression = new RegExp(`(?:^|\\n)\\s*(?:${labels.join("|")})\\s*[：:]\\s*([^\\n]{1,${max}})`, "im");
  return text(expression.exec(block)?.[1], max);
}

function tickerFrom(block) {
  const labeledTicker = labeled(block, ["ticker", "symbol", "股票代码", "代码"], 24)
    .match(/[A-Z0-9.-]{1,12}(?:\s*(?:US|HK|CH|SZ|SS))?/i)?.[0];
  if (labeledTicker) return labeledTicker.toUpperCase().replace(/\s+/g, " ");
  const marketTicker = block.match(/\b(?:NASDAQ|NYSE|HKEX|SSE|SZSE)\s*[：:]\s*([A-Z0-9.-]{1,12})/i)?.[1];
  if (marketTicker) return marketTicker.toUpperCase();
  const parentheticalTicker = block.match(/[（(]\s*((?:\d{5}\.HK)|(?:\d{6}\.(?:SZ|SS))|(?:[A-Z]{1,6}(?:\.[A-Z]{1,3})?))\s*[）)]/i)?.[1];
  return parentheticalTicker ? parentheticalTicker.toUpperCase() : "";
}

function directionFrom(block) {
  if (/(?:\bshort\b|\bunderweight\b|看空|减持|卖出)/i.test(block)) return "short";
  if (/(?:\blong\b|\boverweight\b|看多|增持|买入)/i.test(block)) return "long";
  return "watch";
}

function percentFrom(block, labels) {
  const expression = new RegExp(`(?:${labels.join("|")})[^%+\\-\\d]{0,28}([+\\-]?\\s*\\d{1,3}(?:\\.\\d+)?\\s*%)`, "i");
  const result = expression.exec(block)?.[1];
  return result ? result.replace(/\s+/g, "") : "";
}

function blockStarts(source) {
  const result = new Set([0]);
  const patterns = [
    /(?:^|\n)\s*(?:#{1,6}\s*)?(?:idea|investment idea|投资观点|投资想法|标的|公司|company)\s*[：:]/gim,
    /(?:^|\n)\s*(?:[-*]|\d+[.)])\s*[^\n]{1,140}[（(]\s*(?:\d{5}\.HK|\d{6}\.(?:SZ|SS)|[A-Z]{1,6}(?:\.[A-Z]{1,3})?)\s*[）)]/gm,
  ];
  for (const pattern of patterns) for (const match of source.matchAll(pattern)) result.add((match.index || 0) + (match[0].startsWith("\n") ? 1 : 0));
  return [...result].sort((a, b) => a - b);
}

function candidateFromBlock(block, ordinal) {
  const company = labeled(block, ["company", "公司", "标的", "issuer"], 180);
  const ticker = tickerFrom(block);
  const first = lines(block).find((line) => !/^(?:ticker|symbol|股票代码|代码|company|公司|标的|direction|方向|评级|upside|downside|target|目标价|上行空间|下行风险)\s*[：:]/i.test(line)) || "";
  const explicitTitle = labeled(block, ["title", "标题", "idea", "investment idea", "投资观点", "投资想法"], 220);
  const title = explicitTitle || (company && ticker ? `${company} (${ticker})` : company || first);
  const direction = directionFrom(block);
  const upsideTargetPct = percentFrom(block, ["upside", "target return", "上行空间", "潜在涨幅", "预期涨幅"]);
  const downsideRiskPct = percentFrom(block, ["downside", "风险", "下行空间", "潜在跌幅"]);
  const matchedFields = [title && "title", company && "company", ticker && "ticker", direction !== "watch" && "direction", upsideTargetPct && "upside", downsideRiskPct && "downside"].filter(Boolean);
  if (!title || !matchedFields.length || (matchedFields.length === 1 && matchedFields[0] === "title")) return null;
  return {
    id: `candidate-${ordinal + 1}`,
    title: text(title, 240),
    company: text(company, 180),
    ticker,
    direction,
    upsideTargetPct,
    downsideRiskPct,
    matchedFields,
    extractor: "deterministic-attachment-v1",
  };
}

/**
 * Extract only explicit, structured investment-idea fields from already parsed
 * attachment text. This function is intentionally deterministic: it does not
 * call an external model and never returns the source body or invented thesis.
 */
export function extractIdeaCandidates({ fileName = "", text: source = "" } = {}) {
  const content = String(source || "").slice(0, 500_000);
  if (!content.trim()) return [];
  const starts = blockStarts(content);
  const blocks = starts.map((start, index) => content.slice(start, starts[index + 1] || content.length)).filter(Boolean);
  const seen = new Set();
  const candidates = [];
  for (const block of blocks) {
    const candidate = candidateFromBlock(block, candidates.length);
    if (!candidate) continue;
    const key = `${candidate.ticker}|${candidate.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(candidate);
    if (candidates.length >= MAX_CANDIDATES) break;
  }
  if (!candidates.length) {
    const fallback = candidateFromBlock(`${fileName}\n${content}`, 0);
    if (fallback) candidates.push(fallback);
  }
  return candidates;
}
