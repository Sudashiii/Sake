CREATE TABLE `QueueJobs` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`hash` text NOT NULL,
	`title` text NOT NULL,
	`extension` text NOT NULL,
	`author` text,
	`publisher` text,
	`series` text,
	`volume` text,
	`edition` text,
	`identifier` text,
	`pages` integer,
	`description` text,
	`cover` text,
	`filesize` integer,
	`language` text,
	`year` integer,
	`user_id` text NOT NULL,
	`user_key` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`finished_at` text
);
--> statement-breakpoint
CREATE INDEX `queue_jobs_status_updated_idx` ON `QueueJobs` (`status`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `queue_jobs_created_idx` ON `QueueJobs` (`created_at`);
