BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE data_scope AS ENUM ('private', 'team');
CREATE TYPE member_status AS ENUM ('active', 'pending', 'revoked');
CREATE TYPE job_status AS ENUM ('queued', 'running', 'succeeded', 'failed', 'cancelled');

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  status member_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE team_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id),
  team_id text NOT NULL DEFAULT 'level-grind',
  role text NOT NULL CHECK (role IN ('Owner', 'Admin', 'Analyst', 'PM', 'GEM PM')),
  status member_status NOT NULL DEFAULT 'active',
  invited_by uuid REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

CREATE TABLE user_preferences (
  user_id uuid PRIMARY KEY REFERENCES app_users(id),
  language text NOT NULL DEFAULT 'zh',
  research_scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  output_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE research_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES app_users(id),
  title text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('events', 'aidc', 'reports', 'cross-library')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id)
);
CREATE INDEX research_projects_owner_idx
  ON research_projects(owner_user_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE research_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES app_users(id),
  project_id uuid NOT NULL REFERENCES research_projects(id),
  title text NOT NULL,
  evidence_mode text NOT NULL DEFAULT 'hybrid',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id)
);
CREATE INDEX research_chats_owner_project_idx
  ON research_chats(owner_user_id, project_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE research_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES app_users(id),
  chat_id uuid NOT NULL REFERENCES research_chats(id),
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id)
);
CREATE INDEX research_messages_owner_chat_idx
  ON research_messages(owner_user_id, chat_id, created_at) WHERE deleted_at IS NULL;

CREATE TABLE stored_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES app_users(id),
  scope data_scope NOT NULL,
  object_key text NOT NULL UNIQUE,
  file_name text NOT NULL,
  media_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id)
);

CREATE TABLE knowledge_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES app_users(id),
  scope data_scope NOT NULL DEFAULT 'private',
  title text NOT NULL,
  body_markdown text NOT NULL DEFAULT '',
  source_kind text NOT NULL DEFAULT 'manual',
  source_private_message_id uuid REFERENCES research_messages(id),
  object_id uuid REFERENCES stored_objects(id),
  acl jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  published_by uuid REFERENCES app_users(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id)
);
CREATE INDEX knowledge_items_owner_scope_idx
  ON knowledge_items(owner_user_id, scope, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE evidence_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope data_scope NOT NULL DEFAULT 'team',
  evidence_type text NOT NULL,
  source_system text NOT NULL,
  source_title text,
  source_url_or_asset_id text,
  source_date date,
  observation_date date,
  accessed_at timestamptz,
  rights_status text,
  verification_status text NOT NULL DEFAULT 'unverified',
  raw_excerpt text,
  object_id uuid REFERENCES stored_objects(id),
  created_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id)
);

CREATE TABLE claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_text text NOT NULL,
  claimed_at timestamptz,
  market_timezone text,
  speaker_alias text,
  company text,
  ticker text,
  industry text,
  verification_status text NOT NULL DEFAULT 'unverified',
  evidence_id uuid REFERENCES evidence_records(id),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES app_users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id)
);
CREATE INDEX claims_date_idx ON claims(claimed_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX claims_company_idx ON claims(company, ticker) WHERE deleted_at IS NULL;

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  event_type text NOT NULL,
  event_at timestamptz,
  company text,
  ticker text,
  industry text,
  verification_status text NOT NULL DEFAULT 'unverified',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES app_users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id)
);

CREATE TABLE claim_event_links (
  claim_id uuid NOT NULL REFERENCES claims(id),
  event_id uuid NOT NULL REFERENCES events(id),
  relation text NOT NULL DEFAULT 'supports',
  created_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (claim_id, event_id)
);

CREATE TABLE market_price_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL,
  provider text NOT NULL,
  market_timezone text NOT NULL,
  currency text,
  adjusted boolean NOT NULL DEFAULT false,
  last_observation_date date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticker, provider, adjusted)
);

CREATE TABLE market_price_points (
  series_id uuid NOT NULL REFERENCES market_price_series(id),
  trading_date date NOT NULL,
  open numeric,
  high numeric,
  low numeric,
  close numeric NOT NULL CHECK (close > 0),
  adjusted_close numeric CHECK (adjusted_close > 0),
  volume numeric,
  PRIMARY KEY (series_id, trading_date)
);

CREATE TABLE claim_price_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(id),
  series_id uuid NOT NULL REFERENCES market_price_series(id),
  base_date date NOT NULL,
  t0_date date NOT NULL,
  base_close numeric NOT NULL CHECK (base_close > 0),
  returns jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculation_version text NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (claim_id, series_id, calculation_version)
);

CREATE TABLE aidc_projects (
  id text PRIMARY KEY,
  name text NOT NULL,
  owner text NOT NULL,
  country text NOT NULL,
  address text,
  status text NOT NULL,
  source_dataset_version text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id)
);

CREATE TABLE aidc_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES aidc_projects(id),
  observation_date date NOT NULL,
  metric text NOT NULL,
  value numeric,
  unit text,
  status text,
  confidence text,
  evidence_id uuid REFERENCES evidence_records(id),
  source_dataset_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, observation_date, metric, source_dataset_version)
);

CREATE TABLE aidc_locations (
  project_id text PRIMARY KEY REFERENCES aidc_projects(id),
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  precision text NOT NULL,
  evidence_tier integer NOT NULL CHECK (evidence_tier BETWEEN 1 AND 5),
  evidence_id uuid REFERENCES evidence_records(id),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by uuid NOT NULL REFERENCES app_users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  company text,
  ticker text,
  industry text,
  published_at timestamptz,
  object_id uuid NOT NULL REFERENCES stored_objects(id),
  acl jsonb NOT NULL DEFAULT '{"team":true}'::jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id)
);

CREATE TABLE model_workbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  ticker text,
  model_name text NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES app_users(id),
  current_object_id uuid NOT NULL REFERENCES stored_objects(id),
  current_version text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id)
);

CREATE TABLE model_update_variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workbook_id uuid NOT NULL REFERENCES model_workbooks(id),
  variable_key text NOT NULL,
  proposed_value text,
  source_evidence_id uuid REFERENCES evidence_records(id),
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES app_users(id),
  reviewed_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workbook_id, variable_key, source_evidence_id)
);

CREATE TABLE vector_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace text NOT NULL,
  scope data_scope NOT NULL,
  owner_user_id uuid REFERENCES app_users(id),
  source_type text NOT NULL,
  source_id text NOT NULL,
  chunk_index integer NOT NULL,
  embedding_model text NOT NULL,
  content_hash text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope = 'private' AND owner_user_id IS NOT NULL) OR scope = 'team'),
  UNIQUE (namespace, source_type, source_id, chunk_index, embedding_model)
);
CREATE INDEX vector_documents_scope_idx ON vector_documents(scope, owner_user_id, namespace);

CREATE TABLE background_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  dedupe_key text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status job_status NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX background_jobs_active_dedupe_idx
  ON background_jobs(job_type, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status IN ('queued', 'running');

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES app_users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  previous_version integer,
  next_version integer,
  before_data jsonb,
  after_data jsonb,
  source_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_entity_idx ON audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX audit_log_actor_idx ON audit_log(actor_user_id, created_at DESC);

COMMIT;

