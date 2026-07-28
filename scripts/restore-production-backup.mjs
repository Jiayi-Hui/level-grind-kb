import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function quoteValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function flag(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const root = path.resolve(process.argv[2] || "");
if (!process.argv[2]) {
  throw new Error(
    "Usage: node scripts/restore-production-backup.mjs <backup-directory> " +
      "--database <D1-name> --bucket <R2-name> [--apply]",
  );
}

const database = flag("--database");
const bucket = flag("--bucket");
const apply = process.argv.includes("--apply");
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
const generatedDir = path.join(root, "restore");
const sqlPath = path.join(generatedDir, "restore-d1.sql");
await mkdir(generatedDir, { recursive: true });

const sql = [
  "PRAGMA foreign_keys=OFF;",
  "BEGIN TRANSACTION;",
];
for (const table of manifest.d1.tables) {
  if (table.sql) sql.push(`${table.sql};`);
}
for (const table of [...manifest.d1.tables].reverse()) {
  sql.push(`DELETE FROM ${quoteIdentifier(table.name)};`);
}
for (const table of manifest.d1.tables) {
  const rows = JSON.parse(await readFile(path.join(root, table.path), "utf8"));
  for (const row of rows) {
    const columns = Object.keys(row);
    sql.push(
      `INSERT INTO ${quoteIdentifier(table.name)} (` +
        `${columns.map(quoteIdentifier).join(", ")}) VALUES (` +
        `${columns.map((column) => quoteValue(row[column])).join(", ")});`,
    );
  }
}
sql.push("COMMIT;", "PRAGMA foreign_keys=ON;", "");
await writeFile(sqlPath, sql.join("\n"));

console.log(`Prepared D1 restore SQL: ${sqlPath}`);
console.log(`Prepared ${manifest.r2.totalObjects} R2 objects from the manifest.`);

if (!apply) {
  console.log("No remote writes were made. Add --apply with --database and --bucket after reviewing the restore plan.");
  process.exit(0);
}
if (!database || !bucket) {
  throw new Error("--database and --bucket are required with --apply.");
}

const d1 = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", database, "--remote", `--file=${sqlPath}`],
  { stdio: "inherit" },
);
if (d1.status !== 0) throw new Error("D1 restore failed.");

for (const object of manifest.r2.objects) {
  const restored = spawnSync(
    "npx",
    [
      "wrangler",
      "r2",
      "object",
      "put",
      `${bucket}/${object.key}`,
      "--remote",
      `--file=${path.join(root, object.path)}`,
    ],
    { stdio: "inherit" },
  );
  if (restored.status !== 0) throw new Error(`R2 restore failed for ${object.key}.`);
}

console.log("D1 and R2 restore completed.");
