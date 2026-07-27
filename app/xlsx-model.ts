"use client";

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

export type ParsedModelVariable = {
  key: string;
  label: string;
  kind: "input" | "calculation" | "output";
  sheetName: string;
  cellRef: string;
  value: string;
  formula: string;
  unit: string;
  period: string;
  sourceSystem: string;
  sourceUrl: string;
  sourceDate: string;
  isStale: boolean;
};

type Cell = { ref: string; row: number; col: string; value: string; formula: string };

function xml(bytes?: Uint8Array) {
  return bytes ? new DOMParser().parseFromString(strFromU8(bytes), "application/xml") : null;
}

function textContent(node: Element | null) {
  return node?.textContent?.trim() || "";
}

function workbookSheetPaths(files: Record<string, Uint8Array>) {
  const workbook = xml(files["xl/workbook.xml"]);
  const rels = xml(files["xl/_rels/workbook.xml.rels"]);
  const relationMap = new Map(
    Array.from(rels?.getElementsByTagName("Relationship") ?? []).map((node) => [
      node.getAttribute("Id") || "",
      node.getAttribute("Target") || "",
    ]),
  );
  const result = new Map<string, string>();
  for (const sheet of Array.from(workbook?.getElementsByTagName("sheet") ?? [])) {
    const name = sheet.getAttribute("name") || "";
    const relationId = sheet.getAttribute("r:id") || sheet.getAttributeNS(
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "id",
    ) || "";
    const target = relationMap.get(relationId) || "";
    if (!name || !target) continue;
    const cleanTarget = target.replace(/^\/?xl\//, "");
    result.set(name, `xl/${cleanTarget.replace(/^\.\//, "")}`);
  }
  return result;
}

function sharedStrings(files: Record<string, Uint8Array>) {
  const document = xml(files["xl/sharedStrings.xml"]);
  return Array.from(document?.getElementsByTagName("si") ?? []).map((item) =>
    Array.from(item.getElementsByTagName("t")).map((node) => node.textContent || "").join(""),
  );
}

function sheetCells(bytes: Uint8Array, strings: string[]) {
  const document = xml(bytes);
  const cells: Cell[] = [];
  for (const node of Array.from(document?.getElementsByTagName("c") ?? [])) {
    const ref = node.getAttribute("r") || "";
    const match = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!match) continue;
    const type = node.getAttribute("t");
    const formula = textContent(node.getElementsByTagName("f")[0] || null);
    let value = textContent(node.getElementsByTagName("v")[0] || null);
    if (type === "s") value = strings[Number(value)] || "";
    if (type === "inlineStr") value = textContent(node.getElementsByTagName("is")[0] || null);
    cells.push({ ref, col: match[1], row: Number(match[2]), value, formula });
  }
  return cells;
}

function parseVariableSheet(
  sheetName: string,
  kind: ParsedModelVariable["kind"],
  cells: Cell[],
) {
  const rows = new Map<number, Map<string, Cell>>();
  for (const cell of cells) {
    const row = rows.get(cell.row) || new Map<string, Cell>();
    row.set(cell.col, cell);
    rows.set(cell.row, row);
  }
  let headerRow = 0;
  let headers = new Map<string, string>();
  for (const [rowNumber, row] of rows) {
    const byValue = new Map(Array.from(row.values()).map((cell) => [cell.value.trim().toLowerCase(), cell.col]));
    if (byValue.has("key") && byValue.has("label") && byValue.has("value")) {
      headerRow = rowNumber;
      headers = byValue;
      break;
    }
  }
  if (!headerRow) return [];
  const column = (name: string) => headers.get(name.toLowerCase()) || "";
  const get = (row: Map<string, Cell>, name: string) => row.get(column(name));
  const parsed: ParsedModelVariable[] = [];
  for (const [rowNumber, row] of rows) {
    if (rowNumber <= headerRow) continue;
    const key = get(row, "key")?.value.trim() || "";
    if (!key) continue;
    const valueCell = get(row, "value");
    parsed.push({
      key,
      label: get(row, "label")?.value.trim() || key,
      kind,
      sheetName,
      cellRef: valueCell?.ref || "",
      value: valueCell?.value || "",
      formula: valueCell?.formula || get(row, "formula")?.value || "",
      unit: get(row, "unit")?.value || "",
      period: get(row, "period")?.value || "",
      sourceSystem: get(row, "source")?.value || "",
      sourceUrl: get(row, "source url")?.value || "",
      sourceDate: get(row, "source date")?.value || "",
      isStale: /^(yes|true|1|stale)$/i.test(get(row, "stale")?.value || ""),
    });
  }
  return parsed;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function columnNumber(column: string) {
  return column.split("").reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
}

function rowMap(cells: Cell[]) {
  const rows = new Map<number, Cell[]>();
  for (const cell of cells) {
    const row = rows.get(cell.row) || [];
    row.push(cell);
    rows.set(cell.row, row);
  }
  for (const row of rows.values()) row.sort((a, b) => columnNumber(a.col) - columnNumber(b.col));
  return rows;
}

function closestLabel(cell: Cell, rows: Map<number, Cell[]>) {
  const sameRow = rows.get(cell.row) || [];
  const cellColumn = columnNumber(cell.col);
  const left = sameRow
    .filter((candidate) => columnNumber(candidate.col) < cellColumn && candidate.value && Number.isNaN(Number(candidate.value)))
    .at(-1);
  if (left) return left.value.trim();
  for (let offset = 1; offset <= 3; offset += 1) {
    const above = (rows.get(cell.row - offset) || []).find((candidate) => candidate.col === cell.col);
    if (above?.value && Number.isNaN(Number(above.value))) return above.value.trim();
  }
  return "";
}

function closestPeriod(cell: Cell, rows: Map<number, Cell[]>) {
  for (let offset = 1; offset <= 5; offset += 1) {
    const above = (rows.get(cell.row - offset) || []).find((candidate) => candidate.col === cell.col);
    if (above?.value && /(?:19|20)\d{2}|Q[1-4]|LTM|NTM/i.test(above.value)) return above.value.trim();
  }
  return "";
}

function inferUnit(label: string) {
  if (/%|margin|growth|wacc|tax|rate|yield|multiple|turnover/i.test(label)) return "%";
  if (/share|price/i.test(label)) return "$ / share";
  if (/revenue|ebit|ebitda|cash|debt|capex|value|income|assets|proceeds|fcf|nopat/i.test(label)) return "USD mm";
  return "";
}

function parseFinancialModelSheet(
  sheetName: string,
  cells: Cell[],
): ParsedModelVariable[] {
  const rows = rowMap(cells);
  const normalizedSheet = sheetName.toLowerCase();
  const assumptionSheet = /assump|input|driver|historical|actual/i.test(normalizedSheet);
  const outputSheet = /cover|summary|output|valuation|dcf|sotp|sensitivity|trading|check/i.test(normalizedSheet);
  const result: ParsedModelVariable[] = [];
  const outputWords = /value|valuation|enterprise|equity|price|upside|downside|return|irr|multiple|wacc|terminal|fcf|revenue|ebitda|margin/i;

  for (const cell of cells) {
    if (!cell.value || !Number.isFinite(Number(cell.value))) continue;
    const label = closestLabel(cell, rows);
    if (!label || /^(19|20)\d{2}[AE]?$/.test(label)) continue;
    const period = closestPeriod(cell, rows);
    const isFormula = Boolean(cell.formula);
    let kind: ParsedModelVariable["kind"] | null = null;
    if (!isFormula && assumptionSheet) kind = "input";
    else if (isFormula && outputSheet && outputWords.test(label)) kind = "output";
    else if (isFormula && /model|forecast|calc|dcf|sotp/i.test(normalizedSheet) && outputWords.test(label)) kind = "calculation";
    if (!kind) continue;

    const key = slug(`${sheetName}_${label}_${period || cell.ref}`);
    result.push({
      key,
      label: period ? `${label} · ${period}` : label,
      kind,
      sheetName,
      cellRef: cell.ref,
      value: cell.value,
      formula: cell.formula,
      unit: inferUnit(label),
      period,
      sourceSystem: assumptionSheet ? "Workbook input" : "Workbook formula",
      sourceUrl: "",
      sourceDate: "",
      isStale: false,
    });
  }
  return result;
}

export async function parseModelWorkbook(file: File) {
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const paths = workbookSheetPaths(files);
  const strings = sharedStrings(files);
  const variables: ParsedModelVariable[] = [];
  const targets: Array<[string, ParsedModelVariable["kind"]]> = [
    ["Inputs", "input"],
    ["Calculations", "calculation"],
    ["Outputs", "output"],
  ];
  for (const [sheetName, kind] of targets) {
    const path = paths.get(sheetName);
    if (!path || !files[path]) continue;
    variables.push(...parseVariableSheet(sheetName, kind, sheetCells(files[path], strings)));
  }
  const standardTemplate = variables.some((variable) => variable.kind === "input");
  if (!standardTemplate) {
    for (const [sheetName, path] of paths) {
      if (!files[path]) continue;
      variables.push(...parseFinancialModelSheet(sheetName, sheetCells(files[path], strings)));
      if (variables.length >= 500) break;
    }
  }
  const deduped = Array.from(new Map(variables.slice(0, 500).map((variable) => [
    `${variable.sheetName}!${variable.cellRef}`,
    variable,
  ])).values());
  return {
    variables: deduped,
    templateCompatible: deduped.some((variable) => variable.kind === "input"),
    recognitionMode: standardTemplate ? "standard" : deduped.length ? "financial-model" : "archive-only",
  };
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function updateCell(xmlText: string, cellRef: string, value: string) {
  const pattern = new RegExp(`<c([^>]*\\br="${cellRef}"[^>]*)>[\\s\\S]*?<\\/c>`);
  return xmlText.replace(pattern, (_match, attributes: string) => {
    const numeric = Number(value);
    const cleanAttributes = String(attributes).replace(/\s+t="[^"]*"/g, "");
    if (value.trim() !== "" && Number.isFinite(numeric)) {
      return `<c${cleanAttributes}><v>${numeric}</v></c>`;
    }
    return `<c${cleanAttributes} t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
  });
}

export async function exportUpdatedWorkbook(
  original: ArrayBuffer,
  variables: Array<{ kind: string; sheet_name: string; cell_ref: string; value: string }>,
) {
  const files = unzipSync(new Uint8Array(original));
  const paths = workbookSheetPaths(files);
  for (const [sheetName, path] of paths) {
    const edits = variables.filter((variable) => variable.kind === "input" && variable.sheet_name === sheetName);
    if (!edits.length || !files[path]) continue;
    let sheetXml = strFromU8(files[path]);
    for (const edit of edits) sheetXml = updateCell(sheetXml, edit.cell_ref, edit.value);
    files[path] = strToU8(sheetXml);
  }
  if (files["xl/workbook.xml"]) {
    let workbookXml = strFromU8(files["xl/workbook.xml"]);
    if (/<calcPr\b/.test(workbookXml)) {
      workbookXml = workbookXml.replace(/<calcPr\b[^>]*\/?>/, '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>');
    } else {
      workbookXml = workbookXml.replace("</workbook>", '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>');
    }
    files["xl/workbook.xml"] = strToU8(workbookXml);
  }
  return zipSync(files, { level: 6 });
}
