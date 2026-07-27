import fs from "node:fs/promises";

const eventPath = "data/events/event-db-seed.json";
const findingsPath = "data/events/verification-findings-2026-07-27.json";
const claimsPath = "data/events/claim-db-seed.json";
const noticesPath = "data/events/event-notice-seed.json";
const knowledgeSqlPath = "data/events/event-knowledge-seed.sql";
const migrationPath = "drizzle/0011_event_knowledge_seed.sql";

const eventDb = JSON.parse(await fs.readFile(eventPath, "utf8"));
const verification = JSON.parse(await fs.readFile(findingsPath, "utf8"));
const events = eventDb.events;
const findings = verification.findings;
const eventById = new Map(events.map((event) => [event.id, event]));
const generatedAt = verification.generatedAt || new Date().toISOString();

function stableToken(value) {
  return String(value).replaceAll(/[^A-Za-z0-9]+/g, "-").replaceAll(/^-|-$/g, "");
}

function sqlValue(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlText(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function verificationSources(finding) {
  return [
    ...(finding.bbgEvidence ?? []).map((item) => ({
      kind: "bbg-desktop",
      title: `${item.ticker} ${item.field}`,
      publisher: "Bloomberg",
      observedAt: item.date,
      note: String(item.value),
    })),
    ...(finding.dymonEvidence ?? []).map((item) => ({
      kind: `dymon-${item.sourceType}`,
      title: item.title,
      publisher: item.publisher ?? "Dymon MCP",
      observedAt: item.date,
      note: item.note,
    })),
  ];
}

for (const finding of findings) {
  const sources = verificationSources(finding);
  for (const eventId of finding.eventIds) {
    const event = eventById.get(eventId);
    if (!event) continue;
    event.verificationStatus = finding.verificationStatus;
    event.verificationKind = finding.verificationKind;
    event.verificationSummary = finding.summary;
    event.verificationSources = sources;
    event.updatedAt = generatedAt;
    event.tags = Array.from(new Set([
      ...(event.tags ?? []).filter((tag) => !String(tag).startsWith("verification:")),
      `verification:${finding.verificationKind}`,
      `finding:${finding.findingId}`,
    ]));
  }
}

// The BBG evidence in VF-001 directly verifies the Alphabet market-reaction event.
const alphabetReaction = eventById.get("EVT-0045");
const alphabetFinding = findings.find((finding) => finding.findingId === "VF-2026-07-27-001");
if (alphabetReaction && alphabetFinding) {
  alphabetReaction.verificationStatus = "partially_verified";
  alphabetReaction.verificationKind = "public";
  alphabetReaction.verificationSummary = alphabetFinding.summary;
  alphabetReaction.verificationSources = verificationSources(alphabetFinding);
  alphabetReaction.updatedAt = generatedAt;
  alphabetReaction.tags = Array.from(new Set([
    ...(alphabetReaction.tags ?? []).filter((tag) => !String(tag).startsWith("verification:")),
    "verification:public",
    `finding:${alphabetFinding.findingId}`,
  ]));
}

const claims = [];
const links = [];
const notices = [];

for (const event of events) {
  const claimId = `CLM-SEED-${event.id}`;
  claims.push({
    id: claimId,
    claimText: event.title,
    claimType: event.eventNature === "rumor"
      ? "rumor"
      : event.eventNature === "forecast" ? "forecast" : "fact",
    claimedAt: event.eventDate || event.createdAt,
    speaker: "Team",
    company: event.company,
    ticker: event.ticker,
    sourceSystem: "seed-list",
    sourceTitle: event.sourceTitle,
    sourceUrl: event.sourceUrl,
    sourceLocator: event.sourceWeek || event.sourceLocator,
    sourceExcerpt: "",
    verificationStatus: "unverified",
    verificationKind: "candidate",
    confidence: event.confidence,
    createdBy: event.createdBy,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  });
  links.push({
    eventId: event.id,
    claimId,
    relation: "suggests",
    createdAt: event.createdAt,
  });
  notices.push({
    id: `NTC-SEED-${event.id}`,
    eventId: event.id,
    noticedBy: "Team",
    noticedAt: event.eventDate || event.createdAt,
    channel: "wechat",
    noticeType: "shared",
    salience: event.priority === "P0" ? "high" : "normal",
    summary: "",
    sourceMessageId: event.sourceMessageId,
    createdBy: event.createdBy,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  });
}

for (const finding of findings) {
  const summaryClaimId = `CLM-${finding.findingId}-SUMMARY`;
  claims.push({
    id: summaryClaimId,
    claimText: finding.recommendedEventDefinition,
    claimType: "interpretation",
    claimedAt: verification.generatedAt,
    speaker: "Verification pass",
    company: "",
    ticker: "",
    sourceSystem: "dymon+bbg",
    sourceTitle: "Dymon MCP / Bloomberg verification pass",
    sourceUrl: "",
    sourceLocator: finding.findingId,
    sourceExcerpt: finding.summary,
    verificationStatus: "source_verified",
    verificationKind: finding.verificationKind,
    confidence: "high",
    createdBy: "verification:work-computer",
    createdAt: generatedAt,
    updatedAt: generatedAt,
  });
  for (const eventId of finding.eventIds) {
    links.push({ eventId, claimId: summaryClaimId, relation: "supports", createdAt: generatedAt });
  }
  if (finding.findingId === "VF-2026-07-27-001") {
    links.push({ eventId: "EVT-0045", claimId: summaryClaimId, relation: "explains", createdAt: generatedAt });
  }

  for (const [index, evidence] of (finding.bbgEvidence ?? []).entries()) {
    const claimId = `CLM-${stableToken(finding.findingId)}-BBG-${index + 1}`;
    claims.push({
      id: claimId,
      claimText: `${evidence.ticker} ${evidence.field} was ${evidence.value} on ${evidence.date}.`,
      claimType: "fact",
      claimedAt: evidence.date,
      speaker: "Bloomberg Desktop API",
      company: evidence.name ?? "",
      ticker: evidence.ticker,
      sourceSystem: "bbg-desktop",
      sourceTitle: `${evidence.ticker} ${evidence.field}`,
      sourceUrl: "",
      sourceLocator: finding.findingId,
      sourceExcerpt: "",
      verificationStatus: "source_verified",
      verificationKind: "public",
      confidence: "high",
      createdBy: "verification:work-computer",
      createdAt: generatedAt,
      updatedAt: generatedAt,
    });
    for (const eventId of finding.eventIds) {
      links.push({ eventId, claimId, relation: "supports", createdAt: generatedAt });
    }
    if (finding.findingId === "VF-2026-07-27-001") {
      links.push({ eventId: "EVT-0045", claimId, relation: "supports", createdAt: generatedAt });
    }
  }

  for (const [index, evidence] of (finding.dymonEvidence ?? []).entries()) {
    const claimId = `CLM-${stableToken(finding.findingId)}-DYMON-${index + 1}`;
    claims.push({
      id: claimId,
      claimText: evidence.note,
      claimType: "interpretation",
      claimedAt: evidence.date,
      speaker: evidence.publisher ?? "Dymon MCP",
      company: "",
      ticker: "",
      sourceSystem: `dymon-${evidence.sourceType}`,
      sourceTitle: evidence.title,
      sourceUrl: "",
      sourceLocator: finding.findingId,
      sourceExcerpt: "",
      verificationStatus: "source_verified",
      verificationKind: "public",
      confidence: "high",
      createdBy: "verification:work-computer",
      createdAt: generatedAt,
      updatedAt: generatedAt,
    });
    for (const eventId of finding.eventIds) {
      links.push({ eventId, claimId, relation: "supports", createdAt: generatedAt });
    }
  }
}

await fs.writeFile(eventPath, `${JSON.stringify(eventDb, null, 2)}\n`, "utf8");
await fs.writeFile(claimsPath, `${JSON.stringify({ generatedAt, claims, links }, null, 2)}\n`, "utf8");
await fs.writeFile(noticesPath, `${JSON.stringify({ generatedAt, notices }, null, 2)}\n`, "utf8");

const statements = [];
for (const claim of claims) {
  statements.push(
    `INSERT INTO research_claims (id, claim_text, claim_type, claimed_at, speaker, company, ticker, source_system, source_title, source_url, source_locator, source_excerpt, verification_status, verification_kind, confidence, created_by, created_at, updated_at) VALUES (${[
      claim.id, claim.claimText, claim.claimType, claim.claimedAt, claim.speaker,
      claim.company, claim.ticker, claim.sourceSystem, claim.sourceTitle,
      claim.sourceUrl, claim.sourceLocator, claim.sourceExcerpt,
      claim.verificationStatus, claim.verificationKind, claim.confidence,
      claim.createdBy, claim.createdAt, claim.updatedAt,
    ].map(sqlValue).join(", ")}) ON CONFLICT(id) DO UPDATE SET claim_text=excluded.claim_text, claim_type=excluded.claim_type, claimed_at=excluded.claimed_at, speaker=excluded.speaker, company=excluded.company, ticker=excluded.ticker, source_system=excluded.source_system, source_title=excluded.source_title, source_url=excluded.source_url, source_locator=excluded.source_locator, source_excerpt=excluded.source_excerpt, verification_status=excluded.verification_status, verification_kind=excluded.verification_kind, confidence=excluded.confidence, updated_at=excluded.updated_at;`
  );
}
for (const link of links) {
  statements.push(
    `INSERT INTO research_event_claims (event_id, claim_id, relation, created_at) VALUES (${[
      link.eventId, link.claimId, link.relation, link.createdAt,
    ].map(sqlValue).join(", ")}) ON CONFLICT(event_id, claim_id) DO UPDATE SET relation=excluded.relation;`
  );
}
for (const notice of notices) {
  statements.push(
    `INSERT INTO research_event_notices (id, event_id, noticed_by, noticed_at, channel, notice_type, salience, summary, source_message_id, created_by, created_at, updated_at) VALUES (${[
      notice.id, notice.eventId, notice.noticedBy, notice.noticedAt, notice.channel,
      notice.noticeType, notice.salience, notice.summary, notice.sourceMessageId,
      notice.createdBy, notice.createdAt, notice.updatedAt,
    ].map(sqlText).join(", ")}) ON CONFLICT(id) DO UPDATE SET event_id=excluded.event_id, noticed_by=excluded.noticed_by, noticed_at=excluded.noticed_at, channel=excluded.channel, notice_type=excluded.notice_type, salience=excluded.salience, summary=excluded.summary, source_message_id=excluded.source_message_id, updated_at=excluded.updated_at;`
  );
}
await fs.writeFile(knowledgeSqlPath, `${statements.join("\n")}\n`, "utf8");

const eventSeedSql = await fs.readFile("data/events/event-db-seed.sql", "utf8");
const eventStatements = eventSeedSql.split("\n").filter((line) => line.startsWith("INSERT INTO research_events"));
await fs.writeFile(
  migrationPath,
  [
    "-- Seed sanitized Events, Claims, Claim-Event relations, and Team Notices.",
    "-- Raw private chats are intentionally excluded.",
    ...eventStatements,
    ...statements,
    "",
  ].join("\n"),
  "utf8",
);

console.log(JSON.stringify({
  events: events.length,
  partiallyVerifiedEvents: events.filter((event) => event.verificationStatus === "partially_verified").length,
  claims: claims.length,
  links: links.length,
  notices: notices.length,
}));
