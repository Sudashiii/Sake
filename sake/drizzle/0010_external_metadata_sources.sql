ALTER TABLE `Books` ADD `google_books_id` text;--> statement-breakpoint
ALTER TABLE `Books` ADD `open_library_key` text;--> statement-breakpoint
ALTER TABLE `Books` ADD `amazon_asin` text;--> statement-breakpoint
ALTER TABLE `Books` ADD `external_rating` real;--> statement-breakpoint
ALTER TABLE `Books` ADD `external_rating_count` integer;--> statement-breakpoint
ALTER TABLE `Books` ADD `external_reviews_json` text;
