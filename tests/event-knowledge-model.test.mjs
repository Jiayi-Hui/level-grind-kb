import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const events = JSON.parse(await fs.readFile("data/events/event-db-seed.json", "utf8")).events;
const claimSeed = JSON.parse(await fs.readFile("data/events/claim-db-seed.json", "utf8"));
const notices = JSON.parse(await fs.readFile("data/events/event-notice-seed.json", "utf8")).notices;
const migration = await fs.readFile("drizzle/0010_research_claims_notices.sql", "utf8");

test("event knowledge seed keeps events, claims, links, and notices separate", () => {
  const eventIds = new Set(events.map((event) => event.id));
  const claimIds = new Set(claimSeed.claims.map((claim) => claim.id));

  assert.equal(events.length, 45);
  assert.equal(notices.length, 45);
  assert.ok(claimSeed.claims.length > events.length);
  assert.ok(claimSeed.claims.some((claim) => claim.verificationStatus === "source_verified"));
  assert.ok(events.some((event) => event.verificationStatus === "partially_verified"));

  for (const link of claimSeed.links) {
    assert.ok(eventIds.has(link.eventId), `Missing event ${link.eventId}`);
    assert.ok(claimIds.has(link.claimId), `Missing claim ${link.claimId}`);
  }
  for (const notice of notices) {
    assert.ok(eventIds.has(notice.eventId), `Missing notice event ${notice.eventId}`);
    assert.ok(notice.noticedBy);
    assert.ok(notice.noticedAt);
  }
});

test("every cold-start event has a candidate claim and a team notice", () => {
  const suggestedEvents = new Set(
    claimSeed.links
      .filter((link) => link.relation === "suggests")
      .map((link) => link.eventId),
  );
  const noticedEvents = new Set(notices.map((notice) => notice.eventId));
  for (const event of events) {
    assert.ok(suggestedEvents.has(event.id), `No candidate claim for ${event.id}`);
    assert.ok(noticedEvents.has(event.id), `No team notice for ${event.id}`);
  }
});

test("migration creates the independent relational objects", () => {
  assert.match(migration, /CREATE TABLE `research_claims`/);
  assert.match(migration, /CREATE TABLE `research_event_claims`/);
  assert.match(migration, /CREATE TABLE `research_event_notices`/);
  assert.doesNotMatch(migration, /raw private chat/i);
});

test("product exposes a simple Event timeline and source-claim view", async () => {
  const [workspace, eventsRoute, claimsRoute, noticesRoute] = await Promise.all([
    fs.readFile("app/research-workspace.tsx", "utf8"),
    fs.readFile("app/api/events/route.ts", "utf8"),
    fs.readFile("app/api/claims/route.ts", "utf8"),
    fs.readFile("app/api/event-notices/route.ts", "utf8"),
  ]);
  assert.match(workspace, /Event timeline/);
  assert.match(workspace, /Claims & sources/);
  assert.match(workspace, /latest_claim_text/);
  assert.doesNotMatch(workspace, />Metric</);
  assert.doesNotMatch(workspace, />PM relevance</);
  assert.doesNotMatch(workspace, />Evidence</);
  assert.doesNotMatch(workspace, /Team notice ·/);
  assert.match(eventsRoute, /research_event_claims/);
  assert.match(eventsRoute, /latest_claim_text/);
  assert.match(claimsRoute, /INSERT INTO research_claims/);
  assert.match(claimsRoute, /INSERT INTO research_event_claims/);
  assert.match(noticesRoute, /INSERT INTO research_event_notices/);
});
