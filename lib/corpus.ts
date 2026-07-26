import { env } from "cloudflare:workers";

export const corpusDocumentsSchema = `
  CREATE TABLE IF NOT EXISTS corpus_documents (
    id TEXT PRIMARY KEY,
    security_code TEXT NOT NULL,
    company_name TEXT NOT NULL,
    title TEXT NOT NULL,
    document_type TEXT NOT NULL,
    published_at TEXT NOT NULL,
    source_url TEXT NOT NULL,
    file_key TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    page_count INTEGER NOT NULL DEFAULT 0,
    uploaded_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`;

export const corpusChunksSchema = `
  CREATE TABLE IF NOT EXISTS corpus_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    FOREIGN KEY(document_id) REFERENCES corpus_documents(id) ON DELETE CASCADE
  )
`;

export const aiUsageSchema = `
  CREATE TABLE IF NOT EXISTS ai_usage_events (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd TEXT NOT NULL DEFAULT '0',
    latency_ms INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`;

export async function prepareCorpusDb() {
  await env.DB.batch([
    env.DB.prepare(corpusDocumentsSchema),
    env.DB.prepare(corpusChunksSchema),
    env.DB.prepare(aiUsageSchema),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS corpus_documents_company_idx ON corpus_documents(security_code)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS corpus_documents_published_idx ON corpus_documents(published_at)"),
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS corpus_documents_source_idx ON corpus_documents(source_url)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS corpus_chunks_document_idx ON corpus_chunks(document_id)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS corpus_chunks_page_idx ON corpus_chunks(document_id, page_number)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS ai_usage_user_idx ON ai_usage_events(user_email)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS ai_usage_created_idx ON ai_usage_events(created_at)"),
  ]);
}

export function searchTerms(question: string) {
  const normalized = question
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
  const words = normalized.split(/\s+/).filter((word) => word.length >= 2);
  const chinese = normalized.match(/[\p{Script=Han}]{2,}/gu) ?? [];
  const pairs = chinese.flatMap((phrase) => {
    const values = [];
    for (let index = 0; index < phrase.length - 1; index += 2) {
      values.push(phrase.slice(index, index + 2));
    }
    return values;
  });
  return [...new Set([...words, ...pairs])].sort((a, b) => b.length - a.length).slice(0, 8);
}
