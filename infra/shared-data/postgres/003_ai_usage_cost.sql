BEGIN;

-- Additive only: existing Clerk users, sessions and earlier telemetry rows stay
-- valid. Costs are estimates based on the server-side approved price schedule,
-- never a provider billing export.
ALTER TABLE ai_usage_events
  ADD COLUMN IF NOT EXISTS estimated_cost_usd numeric NOT NULL DEFAULT 0
  CHECK (estimated_cost_usd >= 0);

COMMIT;
