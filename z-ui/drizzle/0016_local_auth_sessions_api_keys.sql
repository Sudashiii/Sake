CREATE TABLE `Users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`is_disabled` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_login_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `Users` (`username`);
--> statement-breakpoint
CREATE TABLE `UserSessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`last_used_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`user_agent` text,
	`ip_address` text,
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_sessions_token_hash_unique` ON `UserSessions` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `user_sessions_user_idx` ON `UserSessions` (`user_id`);
--> statement-breakpoint
CREATE INDEX `user_sessions_expires_idx` ON `UserSessions` (`expires_at`);
--> statement-breakpoint
CREATE TABLE `UserApiKeys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`device_id` text NOT NULL,
	`scope` text DEFAULT 'device' NOT NULL,
	`key_prefix` text NOT NULL,
	`key_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`last_used_at` text,
	`expires_at` text,
	`revoked_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_api_keys_key_hash_unique` ON `UserApiKeys` (`key_hash`);
--> statement-breakpoint
CREATE INDEX `user_api_keys_user_idx` ON `UserApiKeys` (`user_id`);
--> statement-breakpoint
CREATE INDEX `user_api_keys_device_idx` ON `UserApiKeys` (`device_id`);
