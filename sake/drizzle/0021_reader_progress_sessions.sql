ALTER TABLE `BookProgressHistory` ADD `reader_session_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `book_progress_history_book_reader_session_unique` ON `BookProgressHistory` (`book_id`,`reader_session_id`);
