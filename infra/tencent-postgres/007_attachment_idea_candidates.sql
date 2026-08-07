BEGIN;

-- Deterministic, review-only candidates derived from the server-side parsed
-- text of an Idea attachment. They contain only explicit structured fields,
-- never the raw source body or an LLM-generated thesis.
ALTER TABLE research_attachment_extractions
  ADD COLUMN IF NOT EXISTS idea_candidates jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
