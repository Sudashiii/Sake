ALTER TABLE `Books` ADD `read_at` text;--> statement-breakpoint
ALTER TABLE `Books` ADD `exclude_from_new_books` integer DEFAULT 0 NOT NULL;
