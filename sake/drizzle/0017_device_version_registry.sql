CREATE TABLE `Devices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`device_id` text NOT NULL,
	`plugin_version` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX `devices_user_idx` ON `Devices` (`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_user_device_unique` ON `Devices` (`user_id`,`device_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_device_id_unique` ON `Devices` (`device_id`);
