import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceCandidates = [
  resolve(projectRoot, "..", "event-db", "public", "data", "explorer.json"),
  resolve(projectRoot, "data", "events", "event-research.json"),
];
const output = resolve(projectRoot, "public", "data", "event-research.json");

let payload;
let source;
for (const candidate of sourceCandidates) {
  try {
    payload = JSON.parse(await readFile(candidate, "utf8"));
    source = candidate;
    break;
  } catch {
    // Try the portable tracked snapshot next.
  }
}

if (!payload || !source) {
  throw new Error("Event research snapshot is missing. Run this project beside event-db or restore data/events/event-research.json.");
}

const portable = {
  schemaVersion: payload.schemaVersion,
  publishedAt: payload.publishedAt,
  currentEventId: payload.currentEventId,
  meta: payload.meta,
  tracks: payload.tracks,
  events: payload.events,
  sectorSummaries: payload.sectorSummaries,
  eventReturns: payload.eventReturns,
  eventPricePaths: payload.eventPricePaths,
  claims: payload.claims,
  sources: payload.sources,
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(portable)}\n`);
await writeFile(
  resolve(projectRoot, "data", "events", "event-research.json"),
  `${JSON.stringify(portable)}\n`,
);

console.log(`Synced ${portable.events.length} events and ${portable.eventReturns.length} security reactions from ${source}.`);
