CREATE TABLE `BookProgressHistory` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`progress_percent` real NOT NULL,
	`recorded_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `Books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `book_progress_history_book_recorded_unique` ON `BookProgressHistory` (`book_id`,`recorded_at`);
