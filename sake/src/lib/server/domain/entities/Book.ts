export interface Book {
	id: number;
	zLibId: string | null;
	s3_storage_key: string;
	title: string;
	author: string | null;
	publisher: string | null;
	series: string | null;
	volume: string | null;
	edition: string | null;
	identifier: string | null;
	pages: number | null;
	description: string | null;
	google_books_id: string | null;
	open_library_key: string | null;
	amazon_asin: string | null;
	external_rating: number | null;
	external_rating_count: number | null;
	cover: string | null;
	extension: string | null;
	filesize: number | null;
	language: string | null;
	year: number | null;
	progress_storage_key: string | null;
	progress_updated_at: string | null;
	progress_percent: number | null;
	progress_before_read: number | null;
	rating: number | null;
	read_at: string | null;
	archived_at: string | null;
	exclude_from_new_books: boolean;
	createdAt: string | null;
	deleted_at: string | null;
	trash_expires_at: string | null;
	isDownloaded?: boolean;
}

export type CreateBookInput = Omit<
	Book,
	| 'id'
	| 'createdAt'
	| 'progress_storage_key'
	| 'progress_updated_at'
	| 'progress_percent'
	| 'progress_before_read'
	| 'rating'
	| 'read_at'
	| 'archived_at'
	| 'exclude_from_new_books'
	| 'deleted_at'
	| 'trash_expires_at'
>;

export interface UpdateBookMetadataInput {
	zLibId: string | null;
	title: string;
	author: string | null;
	publisher: string | null;
	series: string | null;
	volume: string | null;
	edition: string | null;
	identifier: string | null;
	pages: number | null;
	description: string | null;
	google_books_id: string | null;
	open_library_key: string | null;
	amazon_asin: string | null;
	external_rating: number | null;
	external_rating_count: number | null;
	cover: string | null;
	extension: string | null;
	filesize: number | null;
	language: string | null;
	year: number | null;
}
