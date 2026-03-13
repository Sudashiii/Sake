CREATE TABLE `DeviceProgressDownloads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deviceId` text NOT NULL,
	`bookId` integer NOT NULL,
	`progress_updated_at` text NOT NULL,
	FOREIGN KEY (`bookId`) REFERENCES `Books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_progress_downloads_device_book_unique` ON `DeviceProgressDownloads` (`deviceId`,`bookId`);