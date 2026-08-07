BEGIN;

-- Governance invariant:
--   Public       = external benchmark only and never crosses to/from internal data.
--   Internal     = ordinary internal research.
--   Confidential = higher-sensitivity internal research; may be manually
--                  downgraded to Internal after review.
-- Legacy Restricted rows are conservatively mapped to Confidential.
UPDATE research_notes SET sensitivity_level='confidential' WHERE sensitivity_level='restricted';
UPDATE research_ideas SET sensitivity_level='confidential' WHERE sensitivity_level='restricted';
UPDATE research_private_search_index SET sensitivity_level='confidential' WHERE sensitivity_level='restricted';

ALTER TABLE research_notes DROP CONSTRAINT IF EXISTS research_notes_sensitivity_level_check;
ALTER TABLE research_ideas DROP CONSTRAINT IF EXISTS research_ideas_sensitivity_level_check;
ALTER TABLE research_private_search_index DROP CONSTRAINT IF EXISTS research_private_search_index_sensitivity_level_check;

ALTER TABLE research_notes ADD CONSTRAINT research_notes_sensitivity_level_check
  CHECK (sensitivity_level IN ('public','internal','confidential'));
ALTER TABLE research_ideas ADD CONSTRAINT research_ideas_sensitivity_level_check
  CHECK (sensitivity_level IN ('public','internal','confidential'));
ALTER TABLE research_private_search_index ADD CONSTRAINT research_private_search_index_sensitivity_level_check
  CHECK (sensitivity_level IN ('public','internal','confidential'));

CREATE OR REPLACE FUNCTION enforce_research_classification_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.sensitivity_level = 'public' AND NEW.sensitivity_level <> 'public' THEN
    RAISE EXCEPTION 'PUBLIC_BENCHMARK_CLASSIFICATION_IMMUTABLE';
  END IF;
  IF OLD.sensitivity_level IN ('internal','confidential') AND NEW.sensitivity_level = 'public' THEN
    RAISE EXCEPTION 'INTERNAL_DATA_CANNOT_BECOME_PUBLIC';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS research_notes_classification_transition ON research_notes;
CREATE TRIGGER research_notes_classification_transition
BEFORE UPDATE OF sensitivity_level ON research_notes
FOR EACH ROW EXECUTE FUNCTION enforce_research_classification_transition();

DROP TRIGGER IF EXISTS research_ideas_classification_transition ON research_ideas;
CREATE TRIGGER research_ideas_classification_transition
BEFORE UPDATE OF sensitivity_level ON research_ideas
FOR EACH ROW EXECUTE FUNCTION enforce_research_classification_transition();

COMMENT ON COLUMN research_notes.sensitivity_level IS 'public=external benchmark; internal/confidential=internal data';
COMMENT ON COLUMN research_ideas.sensitivity_level IS 'public=external benchmark; internal/confidential=internal data';

COMMIT;
