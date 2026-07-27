import fs from "node:fs/promises";
import path from "node:path";

const [inputPath = "data/events/event-db-seed.json", outputPath = "data/events/event-db-seed.sql"] = process.argv.slice(2);

const columns = [
  ["id", "id"],
  ["title", "title"],
  ["event_type", "eventType"],
  ["event_date", "eventDate"],
  ["effective_period", "effectivePeriod"],
  ["company", "company"],
  ["ticker", "ticker"],
  ["sector", "sector"],
  ["geography", "geography"],
  ["summary", "summary"],
  ["event_nature", "eventNature"],
  ["impact_type", "impactType"],
  ["impact_direction", "impactDirection"],
  ["priority", "priority"],
  ["verification_status", "verificationStatus"],
  ["verification_kind", "verificationKind"],
  ["verification_summary", "verificationSummary"],
  ["confidence", "confidence"],
  ["metric_name", "metricName"],
  ["metric_object", "metricObject"],
  ["expected_value", "expectedValue"],
  ["actual_value", "actualValue"],
  ["unit", "unit"],
  ["supplier", "supplier"],
  ["customer", "customer"],
  ["product", "product"],
  ["date_precision", "datePrecision"],
  ["source_class", "sourceClass"],
  ["source_week", "sourceWeek"],
  ["source_locator", "sourceLocator"],
  ["raw_claim", "rawClaim"],
  ["verification_plan", "verificationPlan"],
  ["pm_relevance", "pmRelevance"],
  ["analyst_notes", "analystNotes"],
  ["source_system", "sourceSystem"],
  ["source_title", "sourceTitle"],
  ["source_url", "sourceUrl"],
  ["source_message_id", "sourceMessageId"],
  ["source_excerpt", "sourceExcerpt"],
  ["verification_sources_json", "verificationSourcesJson"],
  ["tags_json", "tagsJson"],
  ["created_by", "createdBy"],
  ["created_at", "createdAt"],
  ["updated_at", "updatedAt"],
];

function sqlValue(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonTags(value) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "string" && value.trim().startsWith("[")) return value;
  if (typeof value === "string") return JSON.stringify(value.split(/[;,]/).map((item) => item.trim()).filter(Boolean));
  return "[]";
}

const raw = JSON.parse(await fs.readFile(inputPath, "utf8"));
const events = Array.isArray(raw) ? raw : raw.events;
if (!Array.isArray(events) || events.length === 0) {
  throw new Error(`No events found in ${inputPath}`);
}

const statements = [
  `-- Generated from ${inputPath}.`,
  "-- Review source confidentiality before executing against any shared/remote D1 database.",
  "BEGIN TRANSACTION;",
];

for (const event of events) {
  const enriched = {
    ...event,
    tagsJson: event.tagsJson ?? jsonTags(event.tags),
    verificationKind: event.verificationKind ?? "candidate",
    verificationSourcesJson: event.verificationSourcesJson ?? JSON.stringify(event.verificationSources ?? []),
    createdBy: event.createdBy ?? "seed:team_event_db_cold_start",
    createdAt: event.createdAt ?? new Date().toISOString(),
    updatedAt: event.updatedAt ?? new Date().toISOString(),
  };
  const columnNames = columns.map(([column]) => column).join(", ");
  const values = columns.map(([, key]) => sqlValue(enriched[key])).join(", ");
  const updates = columns
    .map(([column]) => column)
    .filter((column) => !["id", "created_at"].includes(column))
    .map((column) => `${column}=excluded.${column}`)
    .join(", ");
  statements.push(`INSERT INTO research_events (${columnNames}) VALUES (${values}) ON CONFLICT(id) DO UPDATE SET ${updates};`);
}

statements.push("COMMIT;", "");

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, statements.join("\n"), "utf8");
console.log(`Wrote ${events.length} events to ${outputPath}`);
