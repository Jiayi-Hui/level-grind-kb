import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FORMAT = "level-grind-production-backup";
const TABLE_PAGE_SIZE = 200;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function safeBaseName(key) {
  const base = path.posix.basename(key) || "object";
  return base.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-120) || "object";
}

async function json(response) {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return payload;
}

async function apiFetch(baseUrl, token, query) {
  const url = new URL("/api/admin/backup", baseUrl);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-level-grind-backup-token": token,
      Accept: "application/json",
    },
  });
}

export async function exportProductionBackup({ baseUrl, token, outputDir }) {
  if (!baseUrl || !token || !outputDir) {
    throw new Error("baseUrl, token, and outputDir are required.");
  }

  const root = path.resolve(outputDir);
  const d1Dir = path.join(root, "d1", "tables");
  const r2Dir = path.join(root, "r2", "objects");
  await mkdir(d1Dir, { recursive: true });
  await mkdir(r2Dir, { recursive: true });

  let cursor;
  let firstManifest;
  const r2Objects = [];
  do {
    const page = await json(await apiFetch(baseUrl, token, {
      scope: "manifest",
      cursor,
    }));
    if (page.format !== FORMAT) throw new Error("Unexpected backup API format.");
    firstManifest ??= page;
    r2Objects.push(...page.r2.objects);
    cursor = page.r2.truncated ? page.r2.cursor : undefined;
  } while (cursor);

  const manifest = {
    format: FORMAT,
    formatVersion: 1,
    source: new URL(baseUrl).origin,
    exportedAt: new Date().toISOString(),
    d1: {
      tables: [],
      totalRows: 0,
    },
    r2: {
      objects: [],
      totalObjects: r2Objects.length,
      totalBytes: 0,
    },
  };
  const checksums = [];

  for (const table of firstManifest.d1.tables) {
    const rows = [];
    let offset = 0;
    while (true) {
      const page = await json(await apiFetch(baseUrl, token, {
        scope: "table",
        name: table.name,
        offset,
        limit: TABLE_PAGE_SIZE,
      }));
      rows.push(...page.rows);
      if (page.nextOffset === null) break;
      offset = page.nextOffset;
    }
    if (rows.length !== table.rowCount) {
      throw new Error(`Row-count mismatch for ${table.name}: expected ${table.rowCount}, received ${rows.length}`);
    }
    const relativePath = path.posix.join("d1", "tables", `${table.name}.json`);
    const bytes = Buffer.from(`${JSON.stringify(rows, null, 2)}\n`);
    await writeFile(path.join(root, relativePath), bytes);
    const digest = sha256(bytes);
    checksums.push({ path: relativePath, sha256: digest, bytes: bytes.length });
    manifest.d1.tables.push({
      name: table.name,
      sql: table.sql,
      rowCount: rows.length,
      path: relativePath,
      bytes: bytes.length,
      sha256: digest,
    });
    manifest.d1.totalRows += rows.length;
  }

  const deduplicatedObjects = [...new Map(r2Objects.map((object) => [object.key, object])).values()];
  for (const object of deduplicatedObjects) {
    const response = await apiFetch(baseUrl, token, {
      scope: "object",
      key: object.key,
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to download ${object.key}: HTTP ${response.status} ${message}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== object.size) {
      throw new Error(`Byte-count mismatch for ${object.key}: expected ${object.size}, received ${bytes.length}`);
    }
    const objectName = `${sha256(Buffer.from(object.key)).slice(0, 20)}--${safeBaseName(object.key)}`;
    const relativePath = path.posix.join("r2", "objects", objectName);
    await writeFile(path.join(root, relativePath), bytes);
    const digest = sha256(bytes);
    checksums.push({ path: relativePath, sha256: digest, bytes: bytes.length });
    manifest.r2.objects.push({
      ...object,
      path: relativePath,
      sha256: digest,
    });
    manifest.r2.totalBytes += bytes.length;
  }

  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(root, "manifest.json"), manifestBytes);
  const checksumText = checksums
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((entry) => `${entry.sha256}  ${entry.path}`)
    .join("\n");
  await writeFile(path.join(root, "SHA256SUMS"), `${checksumText}\n`);
  await writeFile(
    path.join(root, "README.md"),
    `# Production backup\n\n` +
      `- Source: ${manifest.source}\n` +
      `- Exported: ${manifest.exportedAt}\n` +
      `- D1: ${manifest.d1.tables.length} tables / ${manifest.d1.totalRows} rows\n` +
      `- R2: ${manifest.r2.totalObjects} objects / ${manifest.r2.totalBytes} bytes\n\n` +
      `Run \`npm run backup:verify -- ${root}\` to verify every exported file.\n`,
  );
  return manifest;
}

async function main() {
  const [baseUrl, outputDir] = process.argv.slice(2);
  const token = process.env.LEVEL_GRIND_SESSION_TOKEN;
  if (!baseUrl || !outputDir || !token) {
    throw new Error(
      "Usage: LEVEL_GRIND_SESSION_TOKEN=... node scripts/export-production-backup.mjs <base-url> <output-dir>",
    );
  }
  const manifest = await exportProductionBackup({ baseUrl, token, outputDir });
  console.log(
    `Exported ${manifest.d1.totalRows} D1 rows and ${manifest.r2.totalObjects} R2 objects to ${path.resolve(outputDir)}`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  await main();
}
