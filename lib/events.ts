import { env } from "cloudflare:workers";

export const eventTypes = [
  "EARNINGS",
  "GUIDANCE",
  "CAPITAL_ALLOCATION",
  "OPERATING_KPI",
  "PRODUCT_TECH_MILESTONE",
  "ORDER_SUPPLY",
  "POLICY_REGULATION",
  "MARKET_STRUCTURE",
] as const;

export const verificationStatuses = [
  "unverified",
  "partially_verified",
  "confirmed",
  "denied",
  "expired",
] as const;

export const claimTypes = [
  "fact",
  "forecast",
  "rumor",
  "estimate",
  "interpretation",
  "denial",
] as const;

export const claimRelations = [
  "supports",
  "contradicts",
  "predicts",
  "explains",
  "denies",
  "suggests",
] as const;

export const claimVerificationStatuses = [
  "unverified",
  "source_verified",
  "misquoted",
  "retracted",
] as const;

export const noticeTypes = [
  "shared",
  "questioned",
  "discussed",
  "challenged",
  "escalated",
  "acted_on",
] as const;

export type ResearchEventInput = {
  id?: string;
  title?: string;
  eventType?: string;
  eventDate?: string;
  effectivePeriod?: string;
  company?: string;
  ticker?: string;
  sector?: string;
  geography?: string;
  summary?: string;
  eventNature?: string;
  impactType?: string;
  impactDirection?: string;
  priority?: string;
  verificationStatus?: string;
  verificationKind?: string;
  verificationSummary?: string;
  confidence?: string;
  metricName?: string;
  metricObject?: string;
  expectedValue?: string;
  actualValue?: string;
  unit?: string;
  supplier?: string;
  customer?: string;
  product?: string;
  datePrecision?: string;
  sourceClass?: string;
  sourceWeek?: string;
  sourceLocator?: string;
  rawClaim?: string;
  verificationPlan?: string;
  pmRelevance?: string;
  analystNotes?: string;
  sourceSystem?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  sourceMessageId?: string;
  sourceExcerpt?: string;
  verificationSources?: Array<{
    kind?: string;
    title?: string;
    url?: string;
    publisher?: string;
    observedAt?: string;
    note?: string;
  }> | string;
  tags?: string[] | string;
};

export type ResearchClaimInput = {
  id?: string;
  claimText?: string;
  claimType?: string;
  claimedAt?: string;
  speaker?: string;
  company?: string;
  ticker?: string;
  sourceSystem?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  sourceLocator?: string;
  sourceExcerpt?: string;
  verificationStatus?: string;
  verificationKind?: string;
  confidence?: string;
  eventIds?: string[];
  relation?: string;
};

export type ResearchEventNoticeInput = {
  id?: string;
  eventId?: string;
  noticedBy?: string;
  noticedAt?: string;
  channel?: string;
  noticeType?: string;
  salience?: string;
  summary?: string;
  sourceMessageId?: string;
};

export const researchEventsSchema = `
  CREATE TABLE IF NOT EXISTS research_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_date TEXT,
    effective_period TEXT,
    company TEXT,
    ticker TEXT,
    sector TEXT,
    geography TEXT,
    summary TEXT NOT NULL DEFAULT '',
    event_nature TEXT NOT NULL DEFAULT 'actual',
    impact_type TEXT NOT NULL DEFAULT 'fundamental',
    impact_direction TEXT NOT NULL DEFAULT 'mixed',
    priority TEXT NOT NULL DEFAULT 'P1',
    verification_status TEXT NOT NULL DEFAULT 'unverified',
    verification_kind TEXT NOT NULL DEFAULT 'candidate',
    verification_summary TEXT,
    confidence TEXT NOT NULL DEFAULT 'medium',
    metric_name TEXT,
    metric_object TEXT,
    expected_value TEXT,
    actual_value TEXT,
    unit TEXT,
    supplier TEXT,
    customer TEXT,
    product TEXT,
    date_precision TEXT,
    source_class TEXT,
    source_week TEXT,
    source_locator TEXT,
    raw_claim TEXT,
    verification_plan TEXT,
    pm_relevance TEXT,
    analyst_notes TEXT,
    source_system TEXT NOT NULL DEFAULT 'manual',
    source_title TEXT,
    source_url TEXT,
    source_message_id TEXT,
    source_excerpt TEXT,
    verification_sources_json TEXT NOT NULL DEFAULT '[]',
    tags_json TEXT NOT NULL DEFAULT '[]',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

export const researchClaimsSchema = `
  CREATE TABLE IF NOT EXISTS research_claims (
    id TEXT PRIMARY KEY,
    claim_text TEXT NOT NULL,
    claim_type TEXT NOT NULL DEFAULT 'fact',
    claimed_at TEXT,
    speaker TEXT,
    company TEXT,
    ticker TEXT,
    source_system TEXT NOT NULL DEFAULT 'manual',
    source_title TEXT,
    source_url TEXT,
    source_locator TEXT,
    source_excerpt TEXT,
    verification_status TEXT NOT NULL DEFAULT 'unverified',
    verification_kind TEXT NOT NULL DEFAULT 'candidate',
    confidence TEXT NOT NULL DEFAULT 'medium',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

export const researchEventClaimsSchema = `
  CREATE TABLE IF NOT EXISTS research_event_claims (
    event_id TEXT NOT NULL,
    claim_id TEXT NOT NULL,
    relation TEXT NOT NULL DEFAULT 'supports',
    created_at TEXT NOT NULL,
    PRIMARY KEY (event_id, claim_id),
    FOREIGN KEY (event_id) REFERENCES research_events(id) ON DELETE CASCADE,
    FOREIGN KEY (claim_id) REFERENCES research_claims(id) ON DELETE CASCADE
  )
`;

export const researchEventNoticesSchema = `
  CREATE TABLE IF NOT EXISTS research_event_notices (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    noticed_by TEXT NOT NULL,
    noticed_at TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'manual',
    notice_type TEXT NOT NULL DEFAULT 'shared',
    salience TEXT NOT NULL DEFAULT 'normal',
    summary TEXT NOT NULL DEFAULT '',
    source_message_id TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES research_events(id) ON DELETE CASCADE
  )
`;

export async function prepareEventsDb() {
  await env.DB.prepare(researchEventsSchema).run();
  await env.DB.prepare(researchClaimsSchema).run();
  await env.DB.prepare(researchEventClaimsSchema).run();
  await env.DB.prepare(researchEventNoticesSchema).run();
  await ensureResearchEventColumns();
  await env.DB.batch([
    env.DB.prepare("CREATE INDEX IF NOT EXISTS research_events_type_date_idx ON research_events(event_type, event_date)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS research_events_company_date_idx ON research_events(company, event_date)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS research_events_priority_idx ON research_events(priority)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS research_events_verification_idx ON research_events(verification_status)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS research_claims_type_claimed_idx ON research_claims(claim_type, claimed_at)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS research_claims_verification_idx ON research_claims(verification_status)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS research_event_claims_claim_idx ON research_event_claims(claim_id)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS research_event_notices_event_idx ON research_event_notices(event_id, noticed_at)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS research_event_notices_type_idx ON research_event_notices(notice_type)"),
  ]);
}

const researchEventColumnAdditions = [
  ["verification_kind", "TEXT NOT NULL DEFAULT 'candidate'"],
  ["verification_summary", "TEXT"],
  ["metric_object", "TEXT"],
  ["date_precision", "TEXT"],
  ["source_class", "TEXT"],
  ["source_week", "TEXT"],
  ["source_locator", "TEXT"],
  ["raw_claim", "TEXT"],
  ["verification_plan", "TEXT"],
  ["pm_relevance", "TEXT"],
  ["analyst_notes", "TEXT"],
  ["verification_sources_json", "TEXT NOT NULL DEFAULT '[]'"],
] as const;

async function ensureResearchEventColumns() {
  const info = await env.DB.prepare("PRAGMA table_info(research_events)").all<{ name: string }>();
  const existing = new Set((info.results ?? []).map((column) => column.name));
  for (const [name, definition] of researchEventColumnAdditions) {
    if (!existing.has(name)) {
      await env.DB.prepare(`ALTER TABLE research_events ADD COLUMN ${name} ${definition}`).run();
    }
  }
}

function clean(value: unknown, max = 800) {
  return String(value ?? "").trim().slice(0, max);
}

function optional(value: unknown, max = 800) {
  const text = clean(value, max);
  return text || null;
}

function choice(value: unknown, allowed: readonly string[], fallback: string) {
  const text = clean(value, 80).toUpperCase();
  const normalized = allowed.find((item) => item.toUpperCase() === text);
  return normalized ?? fallback;
}

function lowerChoice(value: unknown, allowed: readonly string[], fallback: string) {
  const text = clean(value, 80).toLowerCase();
  return allowed.includes(text) ? text : fallback;
}

function tagsJson(tags: ResearchEventInput["tags"]) {
  if (Array.isArray(tags)) {
    return JSON.stringify(tags.map((tag) => clean(tag, 80)).filter(Boolean).slice(0, 12));
  }
  return JSON.stringify(
    clean(tags)
      .split(/[;,]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 12),
  );
}

function verificationSourcesJson(sources: ResearchEventInput["verificationSources"]) {
  if (Array.isArray(sources)) {
    return JSON.stringify(
      sources.map((source) => ({
        kind: clean(source.kind, 40),
        title: clean(source.title, 240),
        url: clean(source.url, 600),
        publisher: clean(source.publisher, 120),
        observedAt: clean(source.observedAt, 80),
        note: clean(source.note, 500),
      })).filter((source) => source.title || source.url || source.note).slice(0, 12),
    );
  }
  const text = clean(sources, 2_000);
  if (!text) return "[]";
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(Array.isArray(parsed) ? parsed.slice(0, 12) : []);
  } catch {
    return JSON.stringify([{ note: text }]);
  }
}

export function normalizeResearchEvent(input: ResearchEventInput, userEmail: string) {
  const now = new Date().toISOString();
  const eventType = choice(input.eventType, eventTypes, "OPERATING_KPI");
  const title = clean(input.title, 180);
  if (!title) throw new Error("Event title is required.");

  return {
    id: clean(input.id, 120) || crypto.randomUUID(),
    title,
    eventType,
    eventDate: optional(input.eventDate, 40),
    effectivePeriod: optional(input.effectivePeriod, 120),
    company: optional(input.company, 120),
    ticker: optional(input.ticker, 40),
    sector: optional(input.sector, 120),
    geography: optional(input.geography, 80),
    summary: clean(input.summary, 2_000),
    eventNature: lowerChoice(input.eventNature, ["actual", "forecast", "rumor"], "actual"),
    impactType: lowerChoice(input.impactType, ["fundamental", "market"], "fundamental"),
    impactDirection: lowerChoice(input.impactDirection, ["positive", "negative", "mixed", "neutral"], "mixed"),
    priority: choice(input.priority, ["P0", "P1", "P2"], "P1"),
    verificationStatus: lowerChoice(input.verificationStatus, verificationStatuses, "unverified"),
    verificationKind: lowerChoice(input.verificationKind, ["candidate", "internal", "public", "mixed"], "candidate"),
    verificationSummary: optional(input.verificationSummary, 1_000),
    confidence: lowerChoice(input.confidence, ["low", "medium", "high"], "medium"),
    metricName: optional(input.metricName, 160),
    metricObject: optional(input.metricObject, 240),
    expectedValue: optional(input.expectedValue, 160),
    actualValue: optional(input.actualValue, 160),
    unit: optional(input.unit, 80),
    supplier: optional(input.supplier, 120),
    customer: optional(input.customer, 120),
    product: optional(input.product, 160),
    datePrecision: optional(input.datePrecision, 80),
    sourceClass: optional(input.sourceClass, 160),
    sourceWeek: optional(input.sourceWeek, 40),
    sourceLocator: optional(input.sourceLocator, 240),
    rawClaim: optional(input.rawClaim, 1_200),
    verificationPlan: optional(input.verificationPlan, 1_000),
    pmRelevance: optional(input.pmRelevance, 1_000),
    analystNotes: optional(input.analystNotes, 1_000),
    sourceSystem: clean(input.sourceSystem || "manual", 120),
    sourceTitle: optional(input.sourceTitle, 240),
    sourceUrl: optional(input.sourceUrl, 600),
    sourceMessageId: optional(input.sourceMessageId, 160),
    sourceExcerpt: optional(input.sourceExcerpt, 500),
    verificationSourcesJson: verificationSourcesJson(input.verificationSources),
    tagsJson: tagsJson(input.tags),
    createdBy: userEmail,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeResearchClaim(input: ResearchClaimInput, userEmail: string) {
  const now = new Date().toISOString();
  const claimText = clean(input.claimText, 2_000);
  if (!claimText) throw new Error("Claim text is required.");
  return {
    id: clean(input.id, 120) || crypto.randomUUID(),
    claimText,
    claimType: lowerChoice(input.claimType, claimTypes, "fact"),
    claimedAt: optional(input.claimedAt, 80),
    speaker: optional(input.speaker, 160),
    company: optional(input.company, 160),
    ticker: optional(input.ticker, 80),
    sourceSystem: clean(input.sourceSystem || "manual", 120),
    sourceTitle: optional(input.sourceTitle, 300),
    sourceUrl: optional(input.sourceUrl, 600),
    sourceLocator: optional(input.sourceLocator, 300),
    sourceExcerpt: optional(input.sourceExcerpt, 800),
    verificationStatus: lowerChoice(
      input.verificationStatus,
      claimVerificationStatuses,
      "unverified",
    ),
    verificationKind: lowerChoice(
      input.verificationKind,
      ["candidate", "internal", "public", "mixed"],
      "candidate",
    ),
    confidence: lowerChoice(input.confidence, ["low", "medium", "high"], "medium"),
    eventIds: Array.isArray(input.eventIds)
      ? input.eventIds.map((id) => clean(id, 120)).filter(Boolean).slice(0, 20)
      : [],
    relation: lowerChoice(input.relation, claimRelations, "supports"),
    createdBy: userEmail,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeResearchEventNotice(
  input: ResearchEventNoticeInput,
  userEmail: string,
) {
  const now = new Date().toISOString();
  const eventId = clean(input.eventId, 120);
  if (!eventId) throw new Error("Event id is required.");
  return {
    id: clean(input.id, 120) || crypto.randomUUID(),
    eventId,
    noticedBy: clean(input.noticedBy || userEmail, 160),
    noticedAt: clean(input.noticedAt || now, 80),
    channel: clean(input.channel || "manual", 80),
    noticeType: lowerChoice(input.noticeType, noticeTypes, "shared"),
    salience: lowerChoice(input.salience, ["low", "normal", "high"], "normal"),
    summary: clean(input.summary, 1_000),
    sourceMessageId: optional(input.sourceMessageId, 160),
    createdBy: userEmail,
    createdAt: now,
    updatedAt: now,
  };
}
