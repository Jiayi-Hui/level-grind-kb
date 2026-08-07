BEGIN;

-- Attribution is deliberately separate from the authenticated uploader. This
-- lets an authorised manager enter a colleague's supplied material without
-- pretending to be that colleague in either the record or audit trail.
ALTER TABLE research_notes
  ADD COLUMN IF NOT EXISTS source_contributor_user_id uuid REFERENCES research_users(id),
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES research_users(id);

ALTER TABLE research_ideas
  ADD COLUMN IF NOT EXISTS source_contributor_user_id uuid REFERENCES research_users(id),
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES research_users(id);

-- Legacy records had one owner/creator identity. Preserve that history rather
-- than reassigning it during this additive migration.
UPDATE research_notes
  SET source_contributor_user_id = COALESCE(source_contributor_user_id, owner_user_id),
      created_by_user_id = COALESCE(created_by_user_id, owner_user_id);

UPDATE research_ideas
  SET source_contributor_user_id = COALESCE(source_contributor_user_id, owner_user_id),
      created_by_user_id = COALESCE(created_by_user_id, owner_user_id);

ALTER TABLE research_notes
  ALTER COLUMN source_contributor_user_id SET NOT NULL,
  ALTER COLUMN created_by_user_id SET NOT NULL;

ALTER TABLE research_ideas
  ALTER COLUMN source_contributor_user_id SET NOT NULL,
  ALTER COLUMN created_by_user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS research_notes_source_contributor_updated_idx
  ON research_notes(source_contributor_user_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS research_ideas_source_contributor_updated_idx
  ON research_ideas(source_contributor_user_id, updated_at DESC) WHERE deleted_at IS NULL;

COMMIT;
