BEGIN;
CREATE TABLE IF NOT EXISTS price_refresh_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider text NOT NULL,
  status text NOT NULL CHECK (status IN ('running','succeeded','partial','failed')),
  started_at timestamptz NOT NULL, finished_at timestamptz, summary jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS price_refresh_failures (
  refresh_run_id uuid NOT NULL REFERENCES price_refresh_runs(id), claim_id uuid NOT NULL REFERENCES claims(id),
  error_code text NOT NULL, attempted_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (refresh_run_id, claim_id)
);
ALTER TABLE claim_price_windows ADD COLUMN IF NOT EXISTS source_provider text;
ALTER TABLE claim_price_windows ADD COLUMN IF NOT EXISTS source_updated_at timestamptz;
ALTER TABLE claim_price_windows ADD COLUMN IF NOT EXISTS refresh_run_id uuid REFERENCES price_refresh_runs(id);
COMMIT;
