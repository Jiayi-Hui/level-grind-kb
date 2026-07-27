import { env } from "cloudflare:workers";

const statements = [
  `CREATE TABLE IF NOT EXISTS model_workbooks (
    id TEXT PRIMARY KEY, model_name TEXT NOT NULL, company TEXT NOT NULL,
    ticker TEXT NOT NULL DEFAULT '', sector TEXT NOT NULL DEFAULT '',
    owner_email TEXT NOT NULL, owner_name TEXT NOT NULL DEFAULT '',
    version TEXT NOT NULL DEFAULT 'v1', status TEXT NOT NULL DEFAULT 'active',
    file_key TEXT NOT NULL, file_name TEXT NOT NULL, file_size INTEGER NOT NULL,
    source_notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS model_variables (
    id TEXT PRIMARY KEY, model_id TEXT NOT NULL REFERENCES model_workbooks(id) ON DELETE CASCADE,
    variable_key TEXT NOT NULL, label TEXT NOT NULL, kind TEXT NOT NULL,
    sheet_name TEXT NOT NULL, cell_ref TEXT NOT NULL, value TEXT NOT NULL DEFAULT '',
    formula TEXT NOT NULL DEFAULT '', unit TEXT NOT NULL DEFAULT '', period TEXT NOT NULL DEFAULT '',
    source_system TEXT NOT NULL DEFAULT '', source_url TEXT NOT NULL DEFAULT '',
    source_date TEXT, is_stale INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS model_update_queue (
    id TEXT PRIMARY KEY, model_id TEXT NOT NULL REFERENCES model_workbooks(id) ON DELETE CASCADE,
    variable_id TEXT NOT NULL REFERENCES model_variables(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL, source_id TEXT NOT NULL, source_label TEXT NOT NULL,
    source_date TEXT, proposed_value TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by TEXT, reviewed_at TEXT, created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS model_change_log (
    id TEXT PRIMARY KEY, model_id TEXT NOT NULL REFERENCES model_workbooks(id) ON DELETE CASCADE,
    actor_email TEXT NOT NULL, action TEXT NOT NULL, summary TEXT NOT NULL, created_at TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS model_workbooks_company_idx ON model_workbooks(company)",
  "CREATE INDEX IF NOT EXISTS model_workbooks_owner_idx ON model_workbooks(owner_email)",
  "CREATE INDEX IF NOT EXISTS model_workbooks_updated_idx ON model_workbooks(updated_at)",
  "CREATE UNIQUE INDEX IF NOT EXISTS model_variables_key_idx ON model_variables(model_id, variable_key)",
  "CREATE INDEX IF NOT EXISTS model_variables_kind_idx ON model_variables(model_id, kind)",
  "CREATE UNIQUE INDEX IF NOT EXISTS model_update_queue_source_idx ON model_update_queue(model_id, variable_id, source_type, source_id)",
  "CREATE INDEX IF NOT EXISTS model_update_queue_status_idx ON model_update_queue(model_id, status)",
  "CREATE INDEX IF NOT EXISTS model_change_log_model_idx ON model_change_log(model_id, created_at)",
];

export async function prepareModelDb() {
  await env.DB.batch(statements.map((statement) => env.DB.prepare(statement)));
}

export type ModelVariableInput = {
  key?: string;
  label?: string;
  kind?: string;
  sheetName?: string;
  cellRef?: string;
  value?: string | number;
  formula?: string;
  unit?: string;
  period?: string;
  sourceSystem?: string;
  sourceUrl?: string;
  sourceDate?: string;
  isStale?: boolean;
};

export function clean(value: unknown, limit = 180) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, limit);
}

export function cleanVariable(input: ModelVariableInput, index: number) {
  const kind = ["input", "calculation", "output"].includes(clean(input.kind, 20))
    ? clean(input.kind, 20)
    : "input";
  return {
    id: crypto.randomUUID(),
    key: clean(input.key, 80) || `variable_${index + 1}`,
    label: clean(input.label, 180) || clean(input.key, 80) || `Variable ${index + 1}`,
    kind,
    sheetName: clean(input.sheetName, 80) || "Inputs",
    cellRef: clean(input.cellRef, 20).toUpperCase() || `C${index + 2}`,
    value: clean(input.value, 100),
    formula: clean(input.formula, 500),
    unit: clean(input.unit, 40),
    period: clean(input.period, 40),
    sourceSystem: clean(input.sourceSystem, 100),
    sourceUrl: clean(input.sourceUrl, 500),
    sourceDate: /^\d{4}-\d{2}-\d{2}$/.test(clean(input.sourceDate, 10)) ? clean(input.sourceDate, 10) : null,
    isStale: Boolean(input.isStale),
  };
}
