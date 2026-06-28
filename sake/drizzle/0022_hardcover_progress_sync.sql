CREATE TABLE `HardcoverProgressSettings` (
	`id` integer PRIMARY KEY NOT NULL,
	`enabled` integer NOT NULL,
	`last_successful_sync_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `HardcoverProgressSyncJobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`status` text NOT NULL,
	`source_progress_percent` real NOT NULL,
	`source_progress_updated_at` text,
	`is_initial_sync` integer DEFAULT false NOT NULL,
	`hardcover_book_id` text,
	`hardcover_user_book_id` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text,
	`error` text,
	`outcome` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`book_id`) REFERENCES `Books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hardcover_progress_sync_jobs_book_unique` ON `HardcoverProgressSyncJobs` (`book_id`);--> statement-breakpoint
CREATE INDEX `hardcover_progress_sync_jobs_status_retry_idx` ON `HardcoverProgressSyncJobs` (`status`,`next_attempt_at`);--> statement-breakpoint
ALTER TABLE `Books` ADD `hardcover_id` text;
