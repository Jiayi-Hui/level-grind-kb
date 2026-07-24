CREATE TABLE `document_context` (
	`document_id` text PRIMARY KEY NOT NULL,
	`context_scope` text DEFAULT 'team' NOT NULL,
	`source_system` text DEFAULT 'manual' NOT NULL,
	`topics` text DEFAULT '' NOT NULL,
	`event_date` text,
	`confidence` text DEFAULT 'medium' NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `document_context_scope_idx` ON `document_context` (`context_scope`);--> statement-breakpoint
CREATE INDEX `document_context_source_idx` ON `document_context` (`source_system`);--> statement-breakpoint
CREATE TABLE `personal_contexts` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`coverage` text DEFAULT '' NOT NULL,
	`output_preferences` text DEFAULT '' NOT NULL,
	`working_method` text DEFAULT '' NOT NULL,
	`private_memory` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task_contexts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`objective` text NOT NULL,
	`topic` text DEFAULT 'General' NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`owner_email` text NOT NULL,
	`context_scope` text DEFAULT 'personal+team' NOT NULL,
	`output_format` text DEFAULT 'Concise brief with sources' NOT NULL,
	`guardrails` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `task_context_owner_idx` ON `task_contexts` (`owner_email`);--> statement-breakpoint
CREATE INDEX `task_context_status_idx` ON `task_contexts` (`status`);