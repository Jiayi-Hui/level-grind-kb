import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import {
  normalizeResearchClaim,
  prepareEventsDb,
  ResearchClaimInput,
} from "../../../../lib/events";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

type ClaimInboxInput = {
  messageId?: string;
  text?: string;
  sentAt?: string;
  sender?: string;
  company?: string;
  ticker?: string;
  claimType?: string;
  confidence?: string;
  eventIds?: string[];
  relation?: string;
  sourceDetail?: string;
};

function secretMatches(provided: string, expected: string) {
  const left = new TextEncoder().encode(provided);
  const right = new TextEncoder().encode(expected);
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return mismatch === 0;
}

export async function POST(request: NextRequest) {
  const expectedSecret = runtimeEnv("CLAIM_INGEST_SECRET")?.trim() ?? "";
  const providedSecret = request.headers.get("x-claim-ingest-secret")?.trim() ?? "";
  if (!expectedSecret || !providedSecret || !secretMatches(providedSecret, expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized claim intake." }, { status: 401 });
  }

  let body: ClaimInboxInput;
  try {
    body = await request.json() as ClaimInboxInput;
  } catch {
    return NextResponse.json({ error: "Provide a JSON claim payload." }, { status: 400 });
  }

  const text = String(body.text ?? "").trim();
  if (!text || text.length > 2_000) {
    return NextResponse.json({ error: "Claim text must contain 1-2,000 characters." }, { status: 400 });
  }

  const messageId = String(body.messageId ?? "").trim();
  const sourceLocator = messageId
    ? `wechat-message:${messageId}`
    : `wechat-message:${crypto.randomUUID()}`;
  const input: ResearchClaimInput = {
    id: messageId ? `wechat:${messageId}` : undefined,
    claimText: text,
    claimType: body.claimType || "fact",
    claimedAt: body.sentAt || new Date().toISOString(),
    speaker: body.sender || "WeChat Group",
    company: body.company,
    ticker: body.ticker,
    sourceSystem: "wechat-group",
    sourceTitle: "WeChat Bot → Codex",
    sourceLocator,
    sourceExcerpt: body.sourceDetail,
    verificationStatus: "unverified",
    verificationKind: "candidate",
    confidence: body.confidence || "medium",
    eventIds: body.eventIds,
    relation: body.relation || "suggests",
  };

  await prepareEventsDb();
  const claim = normalizeResearchClaim(input, "ingest:wechat-bot");
  const statements = [
    env.DB.prepare(
      `INSERT INTO research_claims (
         id, claim_text, claim_type, claimed_at, speaker, company, ticker,
         source_system, source_title, source_url, source_locator, source_excerpt,
         verification_status, verification_kind, confidence, created_by,
         created_at, updated_at
       ) VALUES (
         ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15,
         ?16, ?17, ?18
       )
       ON CONFLICT(id) DO UPDATE SET
         claim_text = excluded.claim_text,
         claim_type = excluded.claim_type,
         claimed_at = excluded.claimed_at,
         speaker = excluded.speaker,
         company = excluded.company,
         ticker = excluded.ticker,
         source_locator = excluded.source_locator,
         source_excerpt = excluded.source_excerpt,
         confidence = excluded.confidence,
         updated_at = excluded.updated_at`
    ).bind(
      claim.id,
      claim.claimText,
      claim.claimType,
      claim.claimedAt,
      claim.speaker,
      claim.company,
      claim.ticker,
      claim.sourceSystem,
      claim.sourceTitle,
      claim.sourceUrl,
      claim.sourceLocator,
      claim.sourceExcerpt,
      claim.verificationStatus,
      claim.verificationKind,
      claim.confidence,
      claim.createdBy,
      claim.createdAt,
      claim.updatedAt,
    ),
    ...claim.eventIds.map((eventId) =>
      env.DB.prepare(
        `INSERT INTO research_event_claims (event_id, claim_id, relation, created_at)
         SELECT id, ?2, ?3, ?4 FROM research_events WHERE id = ?1
         ON CONFLICT(event_id, claim_id) DO UPDATE SET relation = excluded.relation`
      ).bind(eventId, claim.id, claim.relation, claim.createdAt)
    ),
  ];
  await env.DB.batch(statements);

  return NextResponse.json({
    ok: true,
    claim: {
      id: claim.id,
      text: claim.claimText,
      claimedAt: claim.claimedAt,
      speaker: claim.speaker,
      company: claim.company,
      ticker: claim.ticker,
      source: claim.sourceSystem,
      verificationStatus: claim.verificationStatus,
    },
  });
}
