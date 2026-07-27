CREATE TABLE `research_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`title` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `research_projects_user_updated_idx` ON `research_projects` (`user_email`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `research_chats` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`evidence_mode` text DEFAULT 'hybrid' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `research_chats_project_updated_idx` ON `research_chats` (`user_email`,`project_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `research_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`user_email` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`citations_json` text DEFAULT '[]' NOT NULL,
	`web_results_json` text DEFAULT '[]' NOT NULL,
	`provider` text,
	`model` text,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`estimated_cost_usd` text DEFAULT '0' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `research_messages_chat_created_idx` ON `research_messages` (`chat_id`,`created_at`);
