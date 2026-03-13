CREATE TABLE `PluginReleases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`version` text NOT NULL,
	`file_name` text NOT NULL,
	`storage_key` text NOT NULL,
	`sha256` text NOT NULL,
	`is_latest` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plugin_releases_version_unique` ON `PluginReleases` (`version`);
