BEGIN;

-- Additive migration: existing Notes and Ideas retain their legacy content and
-- gain explicit template metadata plus policy flags.  Legacy Note flags remain
-- the canonical compatibility aliases for internal AI and web search.
ALTER TABLE research_notes
  ADD COLUMN IF NOT EXISTS template_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS view_allowed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS external_ai_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS redaction_required boolean NOT NULL DEFAULT false;

ALTER TABLE research_ideas
  ADD COLUMN IF NOT EXISTS template_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sensitivity_level text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS view_allowed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS internal_ai_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_ai_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS web_search_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS download_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS redaction_required boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE research_ideas
    ADD CONSTRAINT research_ideas_sensitivity_level_check
    CHECK (sensitivity_level IN ('public', 'internal', 'confidential', 'restricted'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
