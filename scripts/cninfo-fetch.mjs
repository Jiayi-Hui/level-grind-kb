import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const API_URL = "https://www.cninfo.com.cn/new/hisAnnouncement/query";
const FILE_BASE_URL = "https://static.cninfo.com.cn/";
const DEFAULT_INPUT = "scripts/cninfo-companies.sample.csv";
const DEFAULT_OUTPUT = "data/cninfo";
const CATEGORIES = "category_ndbg_szsh;category_bndbg_szsh";
const REQUEST_DELAY_MS = 900;

function argument(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function cleanHtml(value = "") {
  return value.replace(/<[^>]+>/g, "").trim();
}

function parseCsv(source) {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.slice(1).map((line, index) => {
    const comma = line.indexOf(",");
    if (comma < 1) throw new Error(`Invalid company row ${index + 2}: ${line}`);
    const code = line.slice(0, comma).trim();
    const name = line.slice(comma + 1).trim();
    if (!/^\d{6}$/.test(code) || !name) {
      throw new Error(`Invalid company row ${index + 2}: ${line}`);
    }
    return { code, name };
  });
}

function documentType(title) {
  if (/半年度报告/.test(title)) return "half-year-report";
  if (/年度报告/.test(title)) return "annual-report";
  return "other";
}

function isFullReport(title) {
  return /(年度报告|半年度报告)$/.test(title) && !/摘要|英文版|取消/.test(title);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function queryCompany(company, dateRange) {
  const body = new URLSearchParams({
    pageNum: "1",
    pageSize: "30",
    column: "szse",
    tabName: "fulltext",
    plate: "",
    stock: "",
    searchkey: company.name,
    secid: "",
    category: CATEGORIES,
    trade: "",
    seDate: dateRange,
    sortName: "time",
    sortType: "desc",
    isHLtitle: "true",
  });
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Referer": "https://www.cninfo.com.cn/new/commonUrl?url=disclosure/list/search",
      "User-Agent": "LevelGrindResearch/0.1",
      "X-Requested-With": "XMLHttpRequest",
    },
    body,
  });
  if (!response.ok) throw new Error(`CNINFO query failed (${response.status})`);
  const payload = await response.json();
  return (payload.announcements ?? [])
    .map((item) => ({
      announcementId: item.announcementId,
      code: item.secCode,
      company: cleanHtml(item.secName),
      title: cleanHtml(item.announcementTitle),
      publishedAt: new Date(item.announcementTime).toISOString(),
      documentType: documentType(cleanHtml(item.announcementTitle)),
      sourceUrl: new URL(item.adjunctUrl, FILE_BASE_URL).toString(),
    }))
    .filter((item) => item.code === company.code && isFullReport(item.title));
}

async function downloadDocument(record, directory) {
  const response = await fetch(record.sourceUrl, {
    headers: { "User-Agent": "LevelGrindResearch/0.1" },
  });
  if (!response.ok) throw new Error(`Document download failed (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.subarray(0, 4).equals(Buffer.from("%PDF"))) {
    throw new Error("Downloaded document is not a PDF");
  }
  const digest = createHash("sha256").update(bytes).digest("hex");
  const date = record.publishedAt.slice(0, 10);
  const filename = `${record.code}_${record.documentType}_${date}_${record.announcementId}.pdf`;
  await writeFile(path.join(directory, filename), bytes);
  return { filename, bytes: bytes.length, sha256: digest };
}

async function main() {
  const input = argument("input", DEFAULT_INPUT);
  const output = argument("output", DEFAULT_OUTPUT);
  const from = argument("from", `${new Date().getUTCFullYear() - 3}-01-01`);
  const to = argument("to", new Date().toISOString().slice(0, 10));
  const limit = Number(argument("limit", "6"));
  const dryRun = process.argv.includes("--dry-run");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("--limit must be an integer between 1 and 100");
  }

  const companies = parseCsv(await readFile(input, "utf8"));
  await mkdir(output, { recursive: true });
  const records = [];

  for (const company of companies) {
    const companyDirectory = path.join(output, company.code);
    await mkdir(companyDirectory, { recursive: true });
    const matches = (await queryCompany(company, `${from}~${to}`)).slice(0, limit);
    for (const match of matches) {
      const file = dryRun ? null : await downloadDocument(match, companyDirectory);
      records.push({ ...match, file });
      if (!dryRun) await sleep(REQUEST_DELAY_MS);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: "CNINFO",
    dateRange: { from, to },
    companies,
    dryRun,
    records,
  };
  await writeFile(path.join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`CNINFO: ${records.length} records for ${companies.length} companies\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
