CREATE TABLE `BookAnnotationIndexes` (
	`book_id` integer PRIMARY KEY NOT NULL,
	`source_progress_updated_at` text,
	`parser_version` integer NOT NULL,
	`status` text NOT NULL,
	`indexed_at` text,
	`attempted_at` text NOT NULL,
	`error` text,
	FOREIGN KEY (`book_id`) REFERENCES `Books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_annotation_indexes_status_idx` ON `BookAnnotationIndexes` (`status`);--> statement-breakpoint
CREATE TABLE `BookAnnotations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`source_id` text NOT NULL,
	`kind` text NOT NULL,
	`page` text NOT NULL,
	`pos0` text,
	`pos1` text,
	`text` text,
	`note` text,
	`chapter` text,
	`drawer` text,
	`color` text,
	`recorded_at` text NOT NULL,
	`updated_at` text,
	`version` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `Books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `book_annotations_book_source_unique` ON `BookAnnotations` (`book_id`,`source_id`);--> statement-breakpoint
CREATE INDEX `book_annotations_book_idx` ON `BookAnnotations` (`book_id`);--> statement-breakpoint
CREATE INDEX `book_annotations_recency_idx` ON `BookAnnotations` (`updated_at`,`recorded_at`,`id`);--> statement-breakpoint
CREATE INDEX `book_annotations_kind_idx` ON `BookAnnotations` (`kind`);--> statement-breakpoint
CREATE INDEX `book_annotations_color_idx` ON `BookAnnotations` (`color`);
