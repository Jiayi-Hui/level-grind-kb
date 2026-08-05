#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const [manifestPath, outputDirectory = ".private-intake/prepared"] = process.argv.slice(2);
if (!manifestPath) throw new Error("Usage: node scripts/prepare-private-intake.mjs <manifest.json> [output-directory]");
const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
const output = resolve(outputDirectory);
await mkdir(output, { recursive: true });
for (const item of manifest.items || []) {
  const source = resolve(item.sourcePath);
  const stat = await import("node:fs/promises").then(({ stat }) => stat(source));
  let body;
  if (/\.(txt|md|markdown)$/i.test(source)) {
    const sourceText = await readFile(source, "utf8");
    if (item.splitMarker) {
      const markerAt = sourceText.indexOf(item.splitMarker);
      if (markerAt < 0) throw new Error(`Split marker not found for ${item.id}`);
      body = item.splitPart === "after" ? sourceText.slice(markerAt) : sourceText.slice(0, markerAt);
    } else body = sourceText;
    body = body.trim();
  }
  const prepared = {
    ...item,
    sourcePath: source,
    sourceFile: basename(source),
    byteSize: stat.size,
    ...(body ? { body } : {}),
    policy: {
      sensitivityLevel: "confidential",
      viewAllowed: false,
      downloadAllowed: false,
      // Raw records stay contributor-only. The server may rank and synthesize
      // them for gray-box AskAI answers without returning the source record.
      internalAiAllowed: true,
      externalAiAllowed: false,
      webSearchAllowed: false,
      redactionRequired: true,
      ...(item.policy || {}),
    },
    preparedAt: new Date().toISOString(),
  };
  await writeFile(resolve(output, `${item.id}.json`), `${JSON.stringify(prepared, null, 2)}\n`);
}
await writeFile(resolve(output, "index.json"), `${JSON.stringify({ batchId: manifest.batchId, count: manifest.items?.length || 0, preparedAt: new Date().toISOString() }, null, 2)}\n`);
console.log(`Prepared ${manifest.items?.length || 0} private intake records in ${output}`);
