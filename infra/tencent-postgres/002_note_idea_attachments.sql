BEGIN;

CREATE TABLE IF NOT EXISTS research_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id text NOT NULL DEFAULT 'level-grind',
  target_type text NOT NULL CHECK (target_type IN ('note', 'idea')),
  target_id uuid NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES research_users(id),
  object_key text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 240),
  media_type text NOT NULL CHECK (media_type IN ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/markdown', 'text/plain')),
  byte_size bigint NOT NULL CHECK (byte_size > 0 AND byte_size <= 26214400),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  upload_status text NOT NULL DEFAULT 'initialized' CHECK (upload_status IN ('initialized', 'uploaded', 'failed')),
  parse_status text NOT NULL DEFAULT 'queued' CHECK (parse_status IN ('queued', 'processing', 'partial', 'ready', 'failed', 'needs_review')),
  parse_error_code text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES research_users(id)
);
CREATE INDEX IF NOT EXISTS research_attachments_target_updated_idx ON research_attachments(team_id, target_type, target_id, updated_at DESC) WHERE deleted_at IS NULL;

-- Parsed text is encrypted before it enters PostgreSQL. The original bytes are
-- stored only through the configured object-store adapter.
CREATE TABLE IF NOT EXISTS research_attachment_extractions (
  attachment_id uuid PRIMARY KEY REFERENCES research_attachments(id),
  text_ciphertext_b64 text NOT NULL,
  text_nonce_b64 text NOT NULL,
  text_auth_tag_b64 text NOT NULL,
  text_wrapped_data_key_b64 text NOT NULL,
  text_key_wrap_nonce_b64 text NOT NULL,
  text_key_wrap_auth_tag_b64 text NOT NULL,
  text_key_version smallint NOT NULL,
  page_count integer,
  paragraph_count integer,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  extracted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_attachment_jobs (
  attachment_id uuid NOT NULL REFERENCES research_attachments(id),
  job_id uuid NOT NULL REFERENCES research_background_jobs(id),
  purpose text NOT NULL CHECK (purpose IN ('upload', 'parse', 'retry')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (attachment_id, job_id)
);

-- Extend the immutable audit vocabulary without weakening append-only rules.
ALTER TABLE research_audit_log DROP CONSTRAINT IF EXISTS research_audit_log_action_check;
ALTER TABLE research_audit_log ADD CONSTRAINT research_audit_log_action_check CHECK (action IN ('view', 'create', 'update', 'soft_delete', 'download', 'ai_use', 'review', 'link', 'unlink', 'ingest_requested', 'upload_init', 'upload_complete', 'parse', 'retry'));

COMMIT;
