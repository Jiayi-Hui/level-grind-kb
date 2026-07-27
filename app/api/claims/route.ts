import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "../../../lib/access";
import {
  normalizeResearchClaim,
  prepareEventsDb,
  ResearchClaimInput,
} from "../../../lib/events";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  await prepareEventsDb();

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const claimType = url.searchParams.get("type")?.trim().toLowerCase() ?? "";
  const where: string[] = [];
  const bindings: string[] = [];
  if (q) {
    where.push(`(
      LOWER(c.claim_text) LIKE ?${bindings.length + 1} OR
      LOWER(c.company) LIKE ?${bindings.length + 1} OR
      LOWER(c.ticker) LIKE ?${bindings.length + 1} OR
      LOWER(c.source_title) LIKE ?${bindings.length + 1}
    )`);
    bindings.push(`%${q}%`);
  }
  if (claimType) {
    where.push(`c.claim_type = ?${bindings.length + 1}`);
    bindings.push(claimType);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const query = env.DB.prepare(
    `SELECT c.id, c.claim_text, c.claim_type, c.claimed_at, c.speaker,
            c.company, c.ticker, c.source_system, c.source_title, c.source_url,
            c.source_locator, c.source_excerpt, c.verification_status,
            c.verification_kind, c.confidence, c.created_by, c.created_at,
            c.updated_at, GROUP_CONCAT(ec.event_id) AS event_ids,
            GROUP_CONCAT(ec.relation) AS relations
     FROM research_claims c
     LEFT JOIN research_event_claims ec ON ec.claim_id = c.id
     ${whereSql}
     GROUP BY c.id
     ORDER BY
       CASE c.verification_status WHEN 'unverified' THEN 0 ELSE 1 END,
       COALESCE(c.claimed_at, c.created_at) DESC
     LIMIT 300`
  );
  const claims = bindings.length ? await query.bind(...bindings).all() : await query.all();
  const stats = await env.DB.prepare(
    `SELECT claim_type, COUNT(*) AS count
     FROM research_claims GROUP BY claim_type ORDER BY count DESC`
  ).all();
  return NextResponse.json({ user, claims: claims.results, stats: stats.results });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  if (user.role !== "owner" && user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  await prepareEventsDb();

  const body = await request.json() as ResearchClaimInput | { claims?: ResearchClaimInput[] };
  const inputs = Array.isArray((body as { claims?: ResearchClaimInput[] }).claims)
    ? (body as { claims: ResearchClaimInput[] }).claims
    : [body as ResearchClaimInput];
  if (!inputs.length || inputs.length > 500) {
    return NextResponse.json({ error: "Provide 1-500 claims." }, { status: 400 });
  }

  const normalized = inputs.map((claim) => normalizeResearchClaim(claim, user.email));
  const statements = normalized.flatMap((claim) => {
    const insert = env.DB.prepare(
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
         source_system = excluded.source_system,
         source_title = excluded.source_title,
         source_url = excluded.source_url,
         source_locator = excluded.source_locator,
         source_excerpt = excluded.source_excerpt,
         verification_status = excluded.verification_status,
         verification_kind = excluded.verification_kind,
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
    );
    const links = claim.eventIds.map((eventId) =>
      env.DB.prepare(
        `INSERT INTO research_event_claims (event_id, claim_id, relation, created_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(event_id, claim_id) DO UPDATE SET relation = excluded.relation`
      ).bind(eventId, claim.id, claim.relation, claim.createdAt)
    );
    return [insert, ...links];
  });
  await env.DB.batch(statements);
  return NextResponse.json({ ok: true, imported: normalized.length });
}
