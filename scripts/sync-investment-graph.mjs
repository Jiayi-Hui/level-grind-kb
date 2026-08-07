import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "..");
const sourceRoot = resolve(process.env.INVESTMENT_GRAPH_ROOT || resolve(repositoryRoot, "../investment-graph"));
const targetRoot = resolve(repositoryRoot, "vendor/investment-graph");
const files = [
  "package.json",
  "src/investment-main.jsx",
  "src/investment-data.js",
  "src/investment-styles.css",
];

const { stdout } = await execFileAsync("git", ["-C", sourceRoot, "rev-parse", "HEAD"]);
const sourceCommit = stdout.trim();
const checksums = {};

for (const relativePath of files) {
  const sourcePath = resolve(sourceRoot, relativePath);
  const targetPath = resolve(targetRoot, relativePath);
  const bytes = await readFile(sourcePath);
  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
  checksums[relativePath] = createHash("sha256").update(bytes).digest("hex");
}

await writeFile(resolve(targetRoot, "SOURCE.json"), `${JSON.stringify({
  repository: "Jiayi-Hui/investment-graph",
  sourceCommit,
  files: checksums,
}, null, 2)}\n`, "utf8");

console.log(`Synced canonical investment graph ${sourceCommit} into vendor/investment-graph.`);
