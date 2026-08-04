import { readFile } from "node:fs/promises";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const migrations = [
  "../../../infra/tencent-postgres/001_notes_p0.sql",
  "../../../infra/tencent-postgres/002_note_idea_attachments.sql",
  "../../../infra/tencent-postgres/003_notes_ideas_template_and_policy.sql",
];
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "false" ? false : undefined });
await client.connect();
try {
  for (const migration of migrations) await client.query(await readFile(new URL(migration, import.meta.url), "utf8"));
  console.log("TencentDB Notes/Ideas migrations applied");
} finally { await client.end(); }
