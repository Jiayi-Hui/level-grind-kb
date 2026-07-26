CREATE TABLE `conversation_workstreams` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`project_name` text NOT NULL,
	`chat_title` text NOT NULL,
	`active_goal` text NOT NULL,
	`deliverable` text DEFAULT '' NOT NULL,
	`shift_reason` text DEFAULT '' NOT NULL,
	`recommended_action` text DEFAULT 'new-chat' NOT NULL,
	`handoff_summary` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `conversation_workstream_owner_idx` ON `conversation_workstreams` (`owner_email`);--> statement-breakpoint
CREATE INDEX `conversation_workstream_status_idx` ON `conversation_workstreams` (`status`);--> statement-breakpoint
CREATE INDEX `conversation_workstream_updated_idx` ON `conversation_workstreams` (`updated_at`);--> statement-breakpoint
CREATE TABLE `routing_policies` (
	`email` text PRIMARY KEY NOT NULL,
	`reminder_enabled` integer DEFAULT true NOT NULL,
	`trigger_rules` text DEFAULT 'Remind me when the goal, deliverable, repository, data boundary, permissions, or long-term workstream changes.' NOT NULL,
	`updated_at` text NOT NULL
);
