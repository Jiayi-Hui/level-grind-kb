CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`source_url` text,
	`author_email` text NOT NULL,
	`author_name` text NOT NULL,
	`project` text DEFAULT 'General' NOT NULL,
	`importance` text DEFAULT 'normal' NOT NULL,
	`visibility` text DEFAULT 'team' NOT NULL,
	`file_key` text,
	`file_name` text,
	`file_type` text,
	`file_size` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
