CREATE TABLE `research_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`claim_text` text NOT NULL,
	`claim_type` text DEFAULT 'fact' NOT NULL,
	`claimed_at` text,
	`speaker` text,
	`company` text,
	`ticker` text,
	`source_system` text DEFAULT 'manual' NOT NULL,
	`source_title` text,
	`source_url` text,
	`source_locator` text,
	`source_excerpt` text,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`verification_kind` text DEFAULT 'candidate' NOT NULL,
	`confidence` text DEFAULT 'medium' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `research_claims_type_claimed_idx` ON `research_claims` (`claim_type`,`claimed_at`);
--> statement-breakpoint
CREATE INDEX `research_claims_verification_idx` ON `research_claims` (`verification_status`);
--> statement-breakpoint
CREATE TABLE `research_event_claims` (
	`event_id` text NOT NULL,
	`claim_id` text NOT NULL,
	`relation` text DEFAULT 'supports' NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY (`event_id`,`claim_id`),
	FOREIGN KEY (`event_id`) REFERENCES `research_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`claim_id`) REFERENCES `research_claims`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `research_event_claims_claim_idx` ON `research_event_claims` (`claim_id`);
--> statement-breakpoint
CREATE TABLE `research_event_notices` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`noticed_by` text NOT NULL,
	`noticed_at` text NOT NULL,
	`channel` text DEFAULT 'manual' NOT NULL,
	`notice_type` text DEFAULT 'shared' NOT NULL,
	`salience` text DEFAULT 'normal' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`source_message_id` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `research_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `research_event_notices_event_idx` ON `research_event_notices` (`event_id`,`noticed_at`);
--> statement-breakpoint
CREATE INDEX `research_event_notices_type_idx` ON `research_event_notices` (`notice_type`);
