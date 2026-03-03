CREATE TABLE `Shelves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`icon` text DEFAULT '📚' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `BookShelves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`shelf_id` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `Books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shelf_id`) REFERENCES `Shelves`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `book_shelves_book_shelf_unique` ON `BookShelves` (`book_id`,`shelf_id`);
