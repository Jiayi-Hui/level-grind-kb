CREATE TABLE `research_queries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`evidence_mode` text DEFAULT 'reports' NOT NULL,
	`citations_json` text DEFAULT '[]' NOT NULL,
	`web_results_json` text DEFAULT '[]' NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`estimated_cost_usd` text DEFAULT '0' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `research_queries_user_created_idx` ON `research_queries` (`user_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`email` text PRIMARY KEY NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`storage_quota_bytes` integer DEFAULT 5368709120 NOT NULL,
	`updated_at` text NOT NULL
);
