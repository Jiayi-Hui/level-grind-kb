BEGIN;

CREATE TABLE IF NOT EXISTS team_claim_overlays (
  source_claim_id text PRIMARY KEY,
  operation text NOT NULL CHECK (operation IN ('add', 'update', 'delete')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES app_users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_claim_overlays_updated_idx
  ON team_claim_overlays(updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id),
  provider text NOT NULL,
  model text NOT NULL,
  thinking_enabled boolean,
  input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  web_credits numeric NOT NULL DEFAULT 0 CHECK (web_credits >= 0),
  latency_ms integer NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  status text NOT NULL CHECK (status IN ('success', 'error')),
  error_code text,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_events_user_created_idx
  ON ai_usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_events_created_idx
  ON ai_usage_events(created_at DESC);

CREATE OR REPLACE FUNCTION mutate_team_claim_overlay(
  p_source_claim_id text,
  p_operation text,
  p_payload jsonb,
  p_expected_version integer,
  p_actor_auth_subject text,
  p_actor_email text,
  p_actor_name text
)
RETURNS team_claim_overlays
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor app_users;
  existing team_claim_overlays;
  result team_claim_overlays;
BEGIN
  IF p_source_claim_id IS NULL OR length(trim(p_source_claim_id)) < 3 THEN
    RAISE EXCEPTION 'LG_INVALID_ID';
  END IF;
  IF p_operation NOT IN ('add', 'update', 'delete') THEN
    RAISE EXCEPTION 'LG_INVALID_OPERATION';
  END IF;

  INSERT INTO app_users (auth_subject, email, display_name)
  VALUES (
    trim(p_actor_auth_subject),
    lower(trim(p_actor_email)),
    left(coalesce(trim(p_actor_name), ''), 160)
  )
  ON CONFLICT (auth_subject) DO UPDATE SET
    email = excluded.email,
    display_name = excluded.display_name,
    updated_at = now()
  RETURNING * INTO actor;

  SELECT * INTO existing
  FROM team_claim_overlays
  WHERE source_claim_id = p_source_claim_id
  FOR UPDATE;

  IF existing.source_claim_id IS NOT NULL
     AND p_expected_version IS DISTINCT FROM existing.version THEN
    RAISE EXCEPTION 'LG_CONFLICT:%', existing.version;
  END IF;
  IF existing.source_claim_id IS NULL
     AND coalesce(p_expected_version, 0) <> 0 THEN
    RAISE EXCEPTION 'LG_CONFLICT:0';
  END IF;

  INSERT INTO team_claim_overlays (
    source_claim_id,
    operation,
    payload,
    version,
    created_by,
    updated_by
  )
  VALUES (
    p_source_claim_id,
    p_operation,
    coalesce(p_payload, '{}'::jsonb),
    1,
    actor.id,
    actor.id
  )
  ON CONFLICT (source_claim_id) DO UPDATE SET
    operation = excluded.operation,
    payload = excluded.payload,
    version = team_claim_overlays.version + 1,
    updated_by = actor.id,
    updated_at = now()
  RETURNING * INTO result;

  INSERT INTO audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    previous_version,
    next_version,
    before_data,
    after_data
  )
  VALUES (
    actor.id,
    'claim_overlay_' || p_operation,
    'claim',
    p_source_claim_id,
    existing.version,
    result.version,
    CASE WHEN existing.source_claim_id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'operation', existing.operation,
        'payload', existing.payload
      )
    END,
    jsonb_build_object(
      'operation', result.operation,
      'payload', result.payload
    )
  );

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION mutate_team_claim_overlay(
  text, text, jsonb, integer, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mutate_team_claim_overlay(
  text, text, jsonb, integer, text, text, text
) TO service_role;

COMMIT;
