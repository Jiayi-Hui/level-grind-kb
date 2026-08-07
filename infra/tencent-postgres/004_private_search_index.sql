BEGIN;

-- Searchable metadata is limited to keyed hashes. Raw Note/Idea/attachment
-- text remains AES-256-GCM encrypted and is decrypted only inside the trusted
-- API after membership and internal-AI policy checks.
CREATE TABLE IF NOT EXISTS research_private_search_index (
  entity_type text NOT NULL CHECK (entity_type IN ('note', 'idea', 'attachment')),
  entity_id uuid NOT NULL,
  parent_type text NOT NULL CHECK (parent_type IN ('note', 'idea')),
  parent_id uuid NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES research_users(id),
  sensitivity_level text NOT NULL CHECK (sensitivity_level IN ('public', 'internal', 'confidential', 'restricted')),
  key_version smallint NOT NULL DEFAULT 1,
  term_hashes text[] NOT NULL DEFAULT ARRAY[]::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS research_private_search_terms_gin_idx
  ON research_private_search_index USING gin(term_hashes);
CREATE INDEX IF NOT EXISTS research_private_search_parent_idx
  ON research_private_search_index(parent_type, parent_id, updated_at DESC);

COMMIT;
