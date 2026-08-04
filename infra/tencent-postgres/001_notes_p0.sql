BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Clerk remains the identity provider. This stable local mapping gives the
-- database a foreign key-safe identity without duplicating authentication.
CREATE TABLE IF NOT EXISTS research_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_team_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id text NOT NULL DEFAULT 'level-grind',
  user_id uuid NOT NULL REFERENCES research_users(id),
  role text NOT NULL DEFAULT 'Analyst' CHECK (role IN ('Owner', 'Admin', 'Analyst', 'PM', 'GEM PM')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- `body_*` never contains plaintext. Every row gets a random AES-256-GCM
-- data key and nonces; that data key is itself AES-256-GCM wrapped by the
-- deployment's NOTES_MASTER_KEY_B64. Keys and content never enter audit logs.
CREATE TABLE IF NOT EXISTS research_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id text NOT NULL DEFAULT 'level-grind',
  owner_user_id uuid NOT NULL REFERENCES research_users(id),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 240),
  body_ciphertext_b64 text NOT NULL,
  body_nonce_b64 text NOT NULL,
  body_auth_tag_b64 text NOT NULL,
  body_wrapped_data_key_b64 text NOT NULL,
  body_key_wrap_nonce_b64 text NOT NULL,
  body_key_wrap_auth_tag_b64 text NOT NULL,
  body_key_version smallint NOT NULL DEFAULT 1,
  source_kind text NOT NULL DEFAULT 'manual_note',
  sensitivity_level text NOT NULL DEFAULT 'internal' CHECK (sensitivity_level IN ('public', 'internal', 'confidential', 'restricted')),
  ai_processing_allowed boolean NOT NULL DEFAULT false,
  external_search_allowed boolean NOT NULL DEFAULT false,
  download_allowed boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES research_users(id)
);
CREATE INDEX IF NOT EXISTS research_notes_team_updated_idx ON research_notes(team_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS research_notes_owner_updated_idx ON research_notes(owner_user_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS research_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id text NOT NULL DEFAULT 'level-grind',
  owner_user_id uuid NOT NULL REFERENCES research_users(id),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 240),
  ticker text NOT NULL DEFAULT '' CHECK (length(ticker) <= 32),
  direction text NOT NULL DEFAULT 'watch' CHECK (direction IN ('long', 'short', 'watch')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'archived')),
  thesis_ciphertext_b64 text NOT NULL,
  thesis_nonce_b64 text NOT NULL,
  thesis_auth_tag_b64 text NOT NULL,
  thesis_wrapped_data_key_b64 text NOT NULL,
  thesis_key_wrap_nonce_b64 text NOT NULL,
  thesis_key_wrap_auth_tag_b64 text NOT NULL,
  thesis_key_version smallint NOT NULL DEFAULT 1,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES research_users(id)
);
CREATE INDEX IF NOT EXISTS research_ideas_team_updated_idx ON research_ideas(team_id, updated_at DESC) WHERE deleted_at IS NULL;

-- Keeps sensitive Idea sections separate while preserving a plain title/status
-- for the team index. Valid section names intentionally match the review form.
CREATE TABLE IF NOT EXISTS research_idea_sections (
  idea_id uuid NOT NULL REFERENCES research_ideas(id),
  section_name text NOT NULL CHECK (section_name IN ('consensus_gap', 'catalysts', 'risks', 'invalidation')),
  ciphertext_b64 text NOT NULL,
  nonce_b64 text NOT NULL,
  auth_tag_b64 text NOT NULL,
  wrapped_data_key_b64 text NOT NULL,
  key_wrap_nonce_b64 text NOT NULL,
  key_wrap_auth_tag_b64 text NOT NULL,
  key_version smallint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (idea_id, section_name)
);

CREATE TABLE IF NOT EXISTS research_idea_note_links (
  idea_id uuid NOT NULL REFERENCES research_ideas(id),
  note_id uuid NOT NULL REFERENCES research_notes(id),
  created_by_user_id uuid NOT NULL REFERENCES research_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (idea_id, note_id)
);

-- Binary files belong in COS; only server-created object metadata lives here.
CREATE TABLE IF NOT EXISTS research_note_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES research_notes(id),
  cos_object_key text NOT NULL UNIQUE,
  file_name text NOT NULL,
  media_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  parse_status text NOT NULL DEFAULT 'uploaded' CHECK (parse_status IN ('uploaded', 'queued', 'processing', 'partial', 'ready', 'failed', 'needs_review')),
  parse_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS research_background_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id text NOT NULL DEFAULT 'level-grind',
  job_type text NOT NULL CHECK (job_type IN ('file_ingest', 'file_parse', 'price_refresh', 'geocode', 'index_refresh')),
  target_type text NOT NULL CHECK (target_type IN ('note', 'idea', 'file', 'event', 'aidc')),
  target_id uuid,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  safe_input jsonb NOT NULL DEFAULT '{}'::jsonb,
  safe_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  created_by_user_id uuid REFERENCES research_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS research_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id text NOT NULL DEFAULT 'level-grind',
  entity_type text NOT NULL CHECK (entity_type IN ('note', 'idea', 'file', 'member', 'job')),
  entity_id uuid,
  actor_user_id uuid NOT NULL REFERENCES research_users(id),
  action text NOT NULL CHECK (action IN ('view', 'create', 'update', 'soft_delete', 'download', 'ai_use', 'review', 'link', 'unlink', 'ingest_requested')),
  previous_version integer,
  next_version integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_audit_log_entity_created_idx ON research_audit_log(entity_type, entity_id, created_at DESC);

-- Application roles can append only. The trigger catches accidental mutation
-- even when a broad service role has inherited table privileges.
CREATE OR REPLACE FUNCTION research_prevent_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'research_audit_log is append-only';
END;
$$;
DROP TRIGGER IF EXISTS research_audit_log_immutable ON research_audit_log;
CREATE TRIGGER research_audit_log_immutable BEFORE UPDATE OR DELETE ON research_audit_log
  FOR EACH ROW EXECUTE FUNCTION research_prevent_audit_mutation();
REVOKE UPDATE, DELETE ON research_audit_log FROM PUBLIC;

COMMIT;
