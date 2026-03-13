CREATE TABLE `Books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`s3_storage_key` text NOT NULL,
	`title` text NOT NULL,
	`zLibId` text,
	`author` text,
	`cover` text,
	`extension` text,
	`filesize` integer,
	`language` text,
	`year` integer,
	`progress_storage_key` text,
	`progress_updated_at` text,
	`createdAt` text
);
--> statement-breakpoint
CREATE TABLE `DeviceDownloads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deviceId` text NOT NULL,
	`bookId` integer NOT NULL,
	FOREIGN KEY (`bookId`) REFERENCES `Books`(`id`) ON UPDATE no action ON DELETE cascade
);
