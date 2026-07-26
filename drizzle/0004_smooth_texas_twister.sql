CREATE TABLE `team_members` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`invited_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `team_members_status_idx` ON `team_members` (`status`);--> statement-breakpoint
CREATE INDEX `team_members_role_idx` ON `team_members` (`role`);