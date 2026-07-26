import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "../../../lib/access";
import {
  CorpusImportError,
  importCorpusPdf,
} from "../../../lib/corpus-import";
import { prepareCorpusDb } from "../../../lib/corpus";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  await prepareCorpusDb();
  const usageWhere = user.role === "owner" || user.role === "admin" ? "" : "WHERE user_email = ?1";
  const usageQuery = env.DB.prepare(
    `SELECT COUNT(*) AS query_count,
            COALESCE(SUM(input_tokens), 0) AS input_tokens,
            COALESCE(SUM(output_tokens), 0) AS output_tokens,
            COALESCE(SUM(CAST(estimated_cost_usd AS REAL)), 0) AS estimated_cost_usd
     FROM ai_usage_events ${usageWhere}`
  );
  const [documents, usage, memberUsage] = await Promise.all([
    env.DB.prepare(
      `SELECT id, security_code, company_name, title, document_type, published_at,
              source_url, file_name, file_size, page_count, created_at
       FROM corpus_documents ORDER BY published_at DESC, company_name`
    ).all(),
    (usageWhere ? usageQuery.bind(user.email) : usageQuery).first(),
    user.role === "owner" || user.role === "admin"
      ? env.DB.prepare(
          `SELECT user_email, COUNT(*) AS query_count,
                  COALESCE(SUM(input_tokens + output_tokens), 0) AS total_tokens,
                  COALESCE(SUM(CAST(estimated_cost_usd AS REAL)), 0) AS estimated_cost_usd
           FROM ai_usage_events GROUP BY user_email ORDER BY total_tokens DESC`
        ).all()
      : Promise.resolve({ results: [] }),
  ]);
  return NextResponse.json({
    documents: documents.results,
    usage: usage ?? { query_count: 0, input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 },
    memberUsage: memberUsage.results,
  });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAppUser(request);
  if (!user) return response;
  if (user.role !== "owner" && user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A PDF file is required." }, { status: 400 });
  }
  try {
    const result = await importCorpusPdf(
      file,
      {
        securityCode: String(form.get("securityCode") ?? ""),
        companyName: String(form.get("companyName") ?? ""),
        title: String(form.get("title") ?? file.name),
        documentType: String(form.get("documentType") ?? "annual-report"),
        publishedAt: String(form.get("publishedAt") ?? ""),
        sourceUrl: String(form.get("sourceUrl") ?? ""),
      },
      user.email,
    );
    return NextResponse.json(result, { status: result.alreadyImported ? 200 : 201 });
  } catch (error) {
    if (error instanceof CorpusImportError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
