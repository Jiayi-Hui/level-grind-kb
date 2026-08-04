"use client";

import { useAuth } from "@clerk/react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  searchClaimsByVector,
  type ClaimVectorSearchResult,
} from "../lib/local-claim-vector-search";

type Horizon = { date: string | null; close: number | null; return: number | null; abnormal: number | null };
type ClaimMapping = {
  mappingType: string;
  ticker: string;
  security: string;
  benchmark: string;
  eventSession: string;
  baseDate: string;
  baseClose: number | null;
  status: string;
  returns: Record<"t0" | "t1" | "t3" | "t5", Horizon>;
  publicCheck: { status: string; priceSource: string } | null;
  publicSymbol: string | null;
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
  prices: Array<{ date: string; close: number; source: string; publicSymbol?: string }>;
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
type SharedClaimOverlay = {
  sourceClaimId: string;
  operation: "add" | "update" | "delete";
  payload: Draft;
  version: number;
  updatedAt: string;
};
type ClaimSortField = "date" | "t0" | "t1" | "t3" | "t5" | "drawdown" | "upside";
type SortDirection = "desc" | "asc";
type LiveMarketSeries = {
  symbol: string;
  marketPrice: number | null;
  marketTime: string | null;
  prices: Array<{ date: string; close: number; source: string }>;
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

function claimDimensions(claim: LedgerClaim) {
  const hasDirectMapping = claim.mappings.some((mapping) => mapping.mappingType.startsWith("Direct"));
  const hasProxyMapping = claim.mappings.some((mapping) => mapping.mappingType === "Proxy basket");
  return {
    company: hasDirectMapping && !hasProxyMapping ? claim.entity : null,
    industry: hasProxyMapping ? claim.entity : null,
  };
}

function claimSortValue(claim: LedgerClaim, field: ClaimSortField) {
  if (field === "date") return Date.parse(`${claim.claimDateStart}T${/^\d{2}:\d{2}$/.test(claim.claimTimeHkt || "") ? claim.claimTimeHkt : "00:00"}:00+08:00`);
  if (field in horizonLabels) return medianReturn(claim, field as typeof horizons[number]);
  const values = claim.mappings.flatMap((mapping) => horizons.map((item) => mapping.returns[item]?.return))
    .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  if (!values.length) return null;
  return field === "drawdown" ? Math.min(...values) : Math.max(...values);
}

function yahooSymbolFor(series: SecuritySeries) {
  const publicSymbol = series.prices.find((price) => price.publicSymbol)?.publicSymbol;
  if (!publicSymbol) return null;
  if (/^\d{6}$/.test(publicSymbol)) return publicSymbol.startsWith("6") ? `${publicSymbol}.SS` : `${publicSymbol}.SZ`;
  return publicSymbol.toUpperCase();
}

function withYahooReturns(mapping: ClaimMapping, prices: SecuritySeries["prices"]) {
  if (!prices.length) return mapping;
  const ordered = [...prices].sort((left, right) => left.date.localeCompare(right.date));
  const baseIndex = ordered.reduce((found, point, index) => point.date <= mapping.baseDate ? index : found, -1);
  const eventIndex = ordered.findIndex((point) => point.date >= mapping.eventSession);
  if (baseIndex < 0 || eventIndex < 0 || !ordered[baseIndex]?.close) return mapping;
  const offsets = { t0: 0, t1: 1, t3: 3, t5: 5 } as const;
  const baseClose = ordered[baseIndex].close;
  const returns = Object.fromEntries(horizons.map((horizon) => {
    const point = ordered[eventIndex + offsets[horizon]];
    return [horizon, point ? {
      date: point.date,
      close: point.close,
      return: point.close / baseClose - 1,
      abnormal: null,
      benchmarkClose: null,
    } : {
      date: null,
      close: null,
      return: null,
      abnormal: null,
      benchmarkClose: null,
    }];
  })) as ClaimMapping["returns"];
  const latestHorizon = [...horizons].reverse().find((horizon) => returns[horizon].date);
  return {
    ...mapping,
    baseClose,
    status: latestHorizon ? `Yahoo Finance live through ${horizonLabels[latestHorizon]}` : mapping.status,
    returns,
    publicCheck: {
      status: latestHorizon === "t5" ? "live complete" : `live partial: ${latestHorizon || "base only"}`,
      priceSource: "Yahoo Finance live",
    },
  };
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
  persistence = "local",
}: {
  liveClaims: LiveClaim[];
  onAsk: (title: string, detail: string) => void;
  persistence?: "local" | "shared";
}) {
  const { getToken } = useAuth();
  const [data, setData] = useState<ClaimLedgerPayload | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [speaker, setSpeaker] = useState("all");
  const [company, setCompany] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [ticker, setTicker] = useState("all");
  const [sortField, setSortField] = useState<ClaimSortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [livePrices, setLivePrices] = useState<Record<string, LiveMarketSeries>>({});
  const [marketUpdatedAt, setMarketUpdatedAt] = useState("");
  const [marketStatus, setMarketStatus] = useState("正在连接 Yahoo Finance…");
  const [searchResults, setSearchResults] = useState<ClaimVectorSearchResult[] | null>(null);
  const [searchStatus, setSearchStatus] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [deletedIds, setDeletedIds] = useState<string[]>(() => loadLocalEdits().deletedIds);
  const [overrides, setOverrides] = useState<Record<string, Draft>>(() => loadLocalEdits().overrides);
  const [added, setAdded] = useState<LedgerClaim[]>(() => loadLocalEdits().added);
  const [editing, setEditing] = useState<LedgerClaim | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [sharedOverlays, setSharedOverlays] = useState<SharedClaimOverlay[]>([]);
  const [sharedReady, setSharedReady] = useState(persistence === "local");
  const [sharedStatus, setSharedStatus] = useState(
    persistence === "shared" ? "正在连接共享数据库…" : "",
  );

  const sharedFetch = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const token = await getToken();
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  }, [getToken]);

  const applySharedOverlays = useCallback((overlays: SharedClaimOverlay[]) => {
    const nextDeleted: string[] = [];
    const nextOverrides: Record<string, Draft> = {};
    const nextAdded: LedgerClaim[] = [];
    overlays.forEach((overlay) => {
      if (overlay.operation === "delete") {
        nextDeleted.push(overlay.sourceClaimId);
      } else if (overlay.operation === "update") {
        nextOverrides[overlay.sourceClaimId] = overlay.payload;
      } else {
        nextAdded.push({
          claimDateStart: overlay.payload.claimDateStart,
          claimDateEnd: null,
          claimTimeHkt: overlay.payload.claimTimeHkt || null,
          claimId: overlay.sourceClaimId,
          eventId: overlay.sourceClaimId.replace(/^CLM/, "EVT"),
          speaker: overlay.payload.speaker || null,
          entity: overlay.payload.entity || null,
          title: overlay.payload.title || overlay.payload.originalClaim.slice(0, 42),
          originalClaim: overlay.payload.originalClaim,
          verificationStatus: "待核验",
          mappings: [],
        });
      }
    });
    setDeletedIds(nextDeleted);
    setOverrides(nextOverrides);
    setAdded(nextAdded);
    setSharedOverlays(overlays);
  }, []);

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

  useEffect(() => {
    if (persistence !== "shared") return;
    let active = true;
    const loadShared = async () => {
      try {
        const response = await sharedFetch("/api/shared-claims", { cache: "no-store" });
        const payload = await response.json() as {
          configured?: boolean;
          overlays?: SharedClaimOverlay[];
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error || "共享数据库暂时不可用");
        if (!payload.configured) {
          if (active) {
            setSharedReady(false);
            setSharedStatus("共享数据库接入中 · 当前只读");
          }
          return;
        }
        let overlays = payload.overlays || [];
        const remoteIds = new Set(overlays.map((overlay) => overlay.sourceClaimId));
        const local = loadLocalEdits() as {
          deletedIds?: string[];
          overrides?: Record<string, Draft>;
          added?: LedgerClaim[];
        };
        const pending = [
          ...(local.deletedIds || []).map((sourceClaimId) => ({
            sourceClaimId,
            operation: "delete" as const,
            payload: emptyDraft,
          })),
          ...Object.entries(local.overrides || {}).map(([sourceClaimId, value]) => ({
            sourceClaimId,
            operation: "update" as const,
            payload: value,
          })),
          ...(local.added || []).map((claim) => ({
            sourceClaimId: claim.claimId,
            operation: "add" as const,
            payload: toDraft(claim),
          })),
        ].filter((item) => !remoteIds.has(item.sourceClaimId));

        let imported = 0;
        for (const item of pending) {
          const migrationResponse = await sharedFetch("/api/shared-claims", {
            method: item.operation === "delete" ? "DELETE" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceClaimId: item.sourceClaimId,
              operation: item.operation,
              payload: item.payload,
              expectedVersion: 0,
            }),
          });
          if (!migrationResponse.ok) {
            const migrationPayload = await migrationResponse.json() as { error?: string };
            throw new Error(migrationPayload.error || "旧浏览器 Claim 迁移失败");
          }
          imported += 1;
        }
        if (pending.length) {
          const backupKey = `level-grind.claim-edits.migrated.${new Date().toISOString()}`;
          window.localStorage.setItem(
            backupKey,
            window.localStorage.getItem("level-grind.claim-edits.v1") || "{}",
          );
          window.localStorage.removeItem("level-grind.claim-edits.v1");
          const refreshed = await sharedFetch("/api/shared-claims", { cache: "no-store" });
          const refreshedPayload = await refreshed.json() as { overlays?: SharedClaimOverlay[] };
          if (refreshed.ok) overlays = refreshedPayload.overlays || overlays;
        }
        if (active) {
          applySharedOverlays(overlays);
          setSharedReady(true);
          setSharedStatus(imported ? `共享数据库已连接 · 已迁移 ${imported} 条本地修改` : "共享数据库已连接");
        }
      } catch (caught) {
        if (active) {
          setSharedReady(false);
          setSharedStatus(caught instanceof Error ? `${caught.message} · 当前只读` : "共享数据库暂时不可用 · 当前只读");
        }
      }
    };
    void loadShared();
    return () => {
      active = false;
    };
  }, [applySharedOverlays, persistence, sharedFetch]);

  useEffect(() => {
    if (!data?.securities.length) return;
    let active = true;
    const symbolToTicker = new Map<string, string>();
    data.securities.forEach((series) => {
      const symbol = yahooSymbolFor(series);
      if (symbol) symbolToTicker.set(symbol, series.ticker);
    });
    const symbols = [...symbolToTicker.keys()];
    const refresh = async () => {
      try {
        const batches = Array.from({ length: Math.ceil(symbols.length / 8) }, (_, index) => symbols.slice(index * 8, index * 8 + 8));
        const payloads = await Promise.all(batches.map(async (batch) => {
          const response = await fetch(`/api/market-prices?symbols=${encodeURIComponent(batch.join(","))}`);
          const payload = await response.json() as { generatedAt?: string; series?: LiveMarketSeries[]; error?: string };
          if (!response.ok) throw new Error(payload.error || "Yahoo Finance 暂时不可用");
          return payload;
        }));
        if (!active) return;
        const next: Record<string, LiveMarketSeries> = {};
        payloads.flatMap((payload) => payload.series || []).forEach((series) => {
          const ticker = symbolToTicker.get(series.symbol);
          if (ticker) next[ticker] = series;
        });
        setLivePrices(next);
        const generatedAt = payloads.map((payload) => payload.generatedAt).filter(Boolean).sort().at(-1) || new Date().toISOString();
        setMarketUpdatedAt(generatedAt);
        setMarketStatus(`Yahoo Finance 已更新 ${Object.keys(next).length}/${symbols.length}`);
      } catch {
        if (active) setMarketStatus("Yahoo Finance 暂不可用，使用已核验快照");
      }
    };
    void refresh();
    // The EdgeOne route keeps a one-hour shared Yahoo cache. An open workspace
    // revalidates on the same cadence; the first viewer after a quiet period
    // triggers the next refresh without depending on a personal computer.
    const interval = window.setInterval(() => void refresh(), 60 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [data]);

  const persist = (nextDeleted: string[], nextOverrides: Record<string, Draft>, nextAdded: LedgerClaim[]) => {
    if (persistence === "shared") return;
    localStorage.setItem("level-grind.claim-edits.v1", JSON.stringify({
      deletedIds: nextDeleted,
      overrides: nextOverrides,
      added: nextAdded,
    }));
  };

  const saveSharedOverlay = async (
    sourceClaimId: string,
    operation: SharedClaimOverlay["operation"],
    payload: Draft,
  ) => {
    const current = sharedOverlays.find((overlay) => overlay.sourceClaimId === sourceClaimId);
    const response = await sharedFetch("/api/shared-claims", {
      method: operation === "delete" ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceClaimId,
        operation,
        payload,
        expectedVersion: current?.version || 0,
      }),
    });
    const result = await response.json() as { overlay?: SharedClaimOverlay; error?: string };
    if (!response.ok || !result.overlay) {
      throw new Error(result.error || "共享 Claim 保存失败");
    }
    const next = [
      result.overlay,
      ...sharedOverlays.filter((overlay) => overlay.sourceClaimId !== sourceClaimId),
    ];
    applySharedOverlays(next);
    return result.overlay;
  };

  const claims = useMemo(() => [
    ...(data?.claims || []).filter((claim) => !deletedIds.includes(claim.claimId)).map((claim) => ({
      ...claim,
      mappings: claim.mappings.map((mapping) => livePrices[mapping.ticker] ? withYahooReturns(mapping, livePrices[mapping.ticker].prices) : mapping),
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
  ], [added, data, deletedIds, liveClaims, livePrices, overrides]);

  const securities = useMemo(() => (data?.securities || []).map((series) => livePrices[series.ticker] ? {
    ...series,
    source: "Yahoo Finance live",
    prices: livePrices[series.ticker].prices,
  } : series), [data, livePrices]);

  const filters = useMemo(() => ({
    speakers: [...new Set(claims.map((claim) => claim.speaker).filter(Boolean) as string[])].sort(),
    companies: [...new Set(claims.map((claim) => claimDimensions(claim).company).filter(Boolean) as string[])].sort(),
    industries: [...new Set(claims.map((claim) => claimDimensions(claim).industry).filter(Boolean) as string[])].sort(),
    tickers: [...new Set(claims.flatMap((claim) => claim.mappings.map((mapping) => mapping.ticker)))].sort(),
  }), [claims]);

  const searchDocuments = useMemo(() => claims.map((claim) => {
    const dimensions = claimDimensions(claim);
    const securities = claim.mappings.flatMap((mapping) => [
      mapping.ticker,
      mapping.security,
      mapping.benchmark,
      mapping.mappingType,
    ]).filter(Boolean);
    return {
      id: claim.claimId,
      text: [
        claim.originalClaim,
        claim.title,
        claim.entity,
        dimensions.company,
        dimensions.industry,
        claim.speaker,
        claim.verificationStatus,
        ...securities,
      ].filter(Boolean).join("；"),
      exact: [
        claim.entity,
        dimensions.company,
        dimensions.industry,
        claim.speaker,
        ...securities,
      ].filter(Boolean).join("；"),
    };
  }), [claims]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      const reset = window.setTimeout(() => {
        setSearchResults(null);
        setSearchStatus("");
      }, 0);
      return () => window.clearTimeout(reset);
    }
    let active = true;
    const task = window.setTimeout(async () => {
      setSearchStatus("正在加载本地向量检索…");
      try {
        const results = await searchClaimsByVector(
          trimmed,
          searchDocuments,
          (message) => {
            if (active) setSearchStatus(message);
          },
        );
        if (!active) return;
        setSearchResults(results);
        setSearchStatus("本地 BGE 向量检索");
      } catch {
        if (!active) return;
        setSearchResults(null);
        setSearchStatus("本地语义模型暂不可用，已回退关键词检索");
      }
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(task);
    };
  }, [query, searchDocuments]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const semanticIds = searchResults ? new Set(searchResults.map((result) => result.id)) : null;
    return claims.filter((claim) => {
      const dimensions = claimDimensions(claim);
      const literalMatch = !needle || [
        claim.originalClaim,
        claim.title,
        claim.entity,
        claim.speaker,
        dimensions.company,
        dimensions.industry,
        ...claim.mappings.flatMap((item) => [item.ticker, item.security]),
      ].filter(Boolean).join(" ").toLowerCase().includes(needle);
      return (
        (literalMatch || Boolean(semanticIds?.has(claim.claimId)))
        && (speaker === "all" || claim.speaker === speaker)
        && (company === "all" || dimensions.company === company)
        && (industry === "all" || dimensions.industry === industry)
        && (ticker === "all" || claim.mappings.some((mapping) => mapping.ticker === ticker))
      );
    }).sort((left, right) => {
      if (needle && searchResults) {
        const scores = new Map(searchResults.map((result) => [result.id, result.score]));
        const relevance = (scores.get(right.claimId) || 0) - (scores.get(left.claimId) || 0);
        if (relevance) return relevance;
      }
      const leftValue = claimSortValue(left, sortField);
      const rightValue = claimSortValue(right, sortField);
      if (leftValue === null || !Number.isFinite(leftValue)) return rightValue === null || !Number.isFinite(rightValue) ? 0 : 1;
      if (rightValue === null || !Number.isFinite(rightValue)) return -1;
      const ordered = sortDirection === "asc" ? leftValue - rightValue : rightValue - leftValue;
      return ordered || right.claimDateStart.localeCompare(left.claimDateStart);
    });
  }, [claims, company, industry, query, searchResults, sortDirection, sortField, speaker, ticker]);

  const selected = filtered.find((claim) => claim.claimId === selectedId) || filtered[0] || null;

  const startEdit = (claim: LedgerClaim | "new") => {
    setEditing(claim);
    setDraft(claim === "new" ? { ...emptyDraft, claimDateStart: new Date().toISOString().slice(0, 10) } : toDraft(claim));
  };

  const saveDraft = async () => {
    if (!draft.claimDateStart || !draft.originalClaim.trim()) return;
    if (persistence === "shared") {
      if (!sharedReady) {
        setSharedStatus("共享数据库尚未就绪 · 已阻止本地假保存");
        return;
      }
      const sourceClaimId = editing === "new"
        ? `CLM-${crypto.randomUUID()}`
        : editing?.claimId;
      if (!sourceClaimId) return;
      try {
        await saveSharedOverlay(
          sourceClaimId,
          editing === "new" ? "add" : "update",
          draft,
        );
        setSelectedId(sourceClaimId);
        setEditing(null);
        setSharedStatus("已保存到团队共享数据库");
      } catch (caught) {
        setSharedStatus(caught instanceof Error ? caught.message : "共享 Claim 保存失败");
      }
      return;
    }
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

  const removeClaim = async (claimId: string) => {
    if (!window.confirm("删除这条 Claim？")) return;
    if (persistence === "shared") {
      if (!sharedReady) {
        setSharedStatus("共享数据库尚未就绪 · 已阻止本地假删除");
        return;
      }
      try {
        await saveSharedOverlay(claimId, "delete", emptyDraft);
        setSelectedId("");
        setSharedStatus("已从团队共享视图删除，可通过审计记录恢复");
      } catch (caught) {
        setSharedStatus(caught instanceof Error ? caught.message : "共享 Claim 删除失败");
      }
      return;
    }
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
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="语义搜索 Claim、公司、行业、主题或股票代码" />
        <button disabled={persistence === "shared" && !sharedReady} onClick={() => startEdit("new")}>＋ 添加 Claim</button>
      </div>
      <div className="claim-filter-row">
        <select value={speaker} onChange={(event) => setSpeaker(event.target.value)}><option value="all">全部发言人</option>{filters.speakers.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={company} onChange={(event) => setCompany(event.target.value)}><option value="all">全部公司</option>{filters.companies.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={industry} onChange={(event) => setIndustry(event.target.value)}><option value="all">全部行业 / 主题</option>{filters.industries.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={ticker} onChange={(event) => setTicker(event.target.value)}><option value="all">全部股票</option>{filters.tickers.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={sortField} onChange={(event) => setSortField(event.target.value as ClaimSortField)}>
          <option value="date">按日期</option><option value="t0">按 T+0</option><option value="t1">按 T+1</option>
          <option value="t3">按 T+3</option><option value="t5">按 T+5</option><option value="drawdown">按最深回撤</option><option value="upside">按最大涨幅</option>
        </select>
        <select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as SortDirection)}>
          <option value="desc">从高到低 / 最新</option><option value="asc">从低到高 / 最早</option>
        </select>
        <span>{filtered.length} 条{searchStatus ? ` · ${searchStatus}` : ""} · {marketStatus}{marketUpdatedAt ? ` · ${new Date(marketUpdatedAt).toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit" })}` : ""}{sharedStatus ? ` · ${sharedStatus}` : ""}</span>
      </div>

      <div className="claim-table-wrap">
        <table className="claim-table">
          <thead><tr><th>日期</th><th>Claim</th><th>公司</th><th>行业 / 主题</th><th>发言人</th><th>证券</th>{horizons.map((item) => <th key={item}>{horizonLabels[item]}</th>)}<th /></tr></thead>
          <tbody>{filtered.map((claim) => (
            <tr key={claim.claimId} className={selected?.claimId === claim.claimId ? "selected" : ""} onClick={() => setSelectedId(claim.claimId)}>
              <td><strong>{claim.claimDateStart}</strong><small>{claim.claimTimeHkt || ""}</small></td>
              <td><button className="claim-title-cell" onClick={() => setSelectedId(claim.claimId)}><strong>{claim.originalClaim}</strong></button></td>
              <td>{claimDimensions(claim).company || "—"}</td>
              <td>{claimDimensions(claim).industry || "—"}</td>
              <td>{claim.speaker || "待定位"}</td>
              <td>{claim.mappings[0]?.ticker || "—"}{claim.mappings.length > 1 && <small> +{claim.mappings.length - 1}</small>}</td>
              {horizons.map((item) => {
                const value = medianReturn(claim, item);
                return <td key={item} className={`claim-return ${tone(value)}`}>{pct(value)}</td>;
              })}
              <td className="claim-row-actions">
                <button onClick={(event) => { event.stopPropagation(); startEdit(claim); }}>编辑</button>
                <button onClick={(event) => { event.stopPropagation(); void removeClaim(claim.claimId); }}>删除</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {selected && <ClaimPriceDetail key={selected.claimId} claim={selected} securities={securities} />}

      {editing && (
        <div className="claim-modal-backdrop" onMouseDown={() => setEditing(null)}>
          <form className="claim-editor" onSubmit={(event) => { event.preventDefault(); void saveDraft(); }} onMouseDown={(event) => event.stopPropagation()}>
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
