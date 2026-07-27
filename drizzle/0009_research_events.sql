CREATE TABLE `research_events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`event_type` text NOT NULL,
	`event_date` text,
	`effective_period` text,
	`company` text,
	`ticker` text,
	`sector` text,
	`geography` text,
	`summary` text DEFAULT '' NOT NULL,
	`event_nature` text DEFAULT 'actual' NOT NULL,
	`impact_type` text DEFAULT 'fundamental' NOT NULL,
	`impact_direction` text DEFAULT 'mixed' NOT NULL,
	`priority` text DEFAULT 'P1' NOT NULL,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`verification_kind` text DEFAULT 'candidate' NOT NULL,
	`verification_summary` text,
	`confidence` text DEFAULT 'medium' NOT NULL,
	`metric_name` text,
	`metric_object` text,
	`expected_value` text,
	`actual_value` text,
	`unit` text,
	`supplier` text,
	`customer` text,
	`product` text,
	`date_precision` text,
	`source_class` text,
	`source_week` text,
	`source_locator` text,
	`raw_claim` text,
	`verification_plan` text,
	`pm_relevance` text,
	`analyst_notes` text,
	`source_system` text DEFAULT 'manual' NOT NULL,
	`source_title` text,
	`source_url` text,
	`source_message_id` text,
	`source_excerpt` text,
	`verification_sources_json` text DEFAULT '[]' NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `research_events_type_date_idx` ON `research_events` (`event_type`,`event_date`);
--> statement-breakpoint
CREATE INDEX `research_events_company_date_idx` ON `research_events` (`company`,`event_date`);
--> statement-breakpoint
CREATE INDEX `research_events_priority_idx` ON `research_events` (`priority`);
--> statement-breakpoint
CREATE INDEX `research_events_verification_idx` ON `research_events` (`verification_status`);
