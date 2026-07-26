CREATE TABLE `ai_usage_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`estimated_cost_usd` text DEFAULT '0' NOT NULL,
	`latency_ms` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_usage_user_idx` ON `ai_usage_events` (`user_email`);--> statement-breakpoint
CREATE INDEX `ai_usage_created_idx` ON `ai_usage_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `corpus_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`page_number` integer NOT NULL,
	`content` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `corpus_documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `corpus_chunks_document_idx` ON `corpus_chunks` (`document_id`);--> statement-breakpoint
CREATE INDEX `corpus_chunks_page_idx` ON `corpus_chunks` (`document_id`,`page_number`);--> statement-breakpoint
CREATE TABLE `corpus_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`security_code` text NOT NULL,
	`company_name` text NOT NULL,
	`title` text NOT NULL,
	`document_type` text NOT NULL,
	`published_at` text NOT NULL,
	`source_url` text NOT NULL,
	`file_key` text NOT NULL,
	`file_name` text NOT NULL,
	`file_size` integer NOT NULL,
	`page_count` integer DEFAULT 0 NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `corpus_documents_company_idx` ON `corpus_documents` (`security_code`);--> statement-breakpoint
CREATE INDEX `corpus_documents_published_idx` ON `corpus_documents` (`published_at`);