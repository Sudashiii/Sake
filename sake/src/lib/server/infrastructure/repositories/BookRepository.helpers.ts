import type {
	Book,
	CreateBookInput,
	UpdateBookMetadataInput
} from '$lib/server/domain/entities/Book';
import { books, deviceDownloads } from '$lib/server/infrastructure/db/schema';
import { sql } from 'drizzle-orm';

export type DbBookRow = {
	id: number;
	s3StorageKey: string;
	title: string;
	zLibId: string | null;
	author: string | null;
	publisher: string | null;
	series: string | null;
	volume: string | null;
	seriesIndex: number | null;
	edition: string | null;
	identifier: string | null;
	pages: number | null;
	description: string | null;
	googleBooksId: string | null;
	openLibraryKey: string | null;
	amazonAsin: string | null;
	externalRating: number | null;
	externalRatingCount: number | null;
	cover: string | null;
	extension: string | null;
	filesize: number | null;
	language: string | null;
	year: number | null;
	month: number | null;
	day: number | null;
	progressStorageKey: string | null;
	progressUpdatedAt: string | null;
	progressPercent: number | null;
	progressBeforeRead: number | null;
	rating: number | null;
	readAt: string | null;
	archivedAt: string | null;
	excludeFromNewBooks: boolean;
	createdAt: string | null;
	deletedAt: string | null;
	trashExpiresAt: string | null;
};

export type DbBookWithDownloadRow = DbBookRow & {
	isDownloaded: number | boolean;
};

export const bookSelection = {
	id: books.id,
	s3StorageKey: books.s3StorageKey,
	title: books.title,
	zLibId: books.zLibId,
	author: books.author,
	publisher: books.publisher,
	series: books.series,
	volume: books.volume,
	seriesIndex: books.seriesIndex,
	edition: books.edition,
	identifier: books.identifier,
	pages: books.pages,
	description: books.description,
	googleBooksId: books.googleBooksId,
	openLibraryKey: books.openLibraryKey,
	amazonAsin: books.amazonAsin,
	externalRating: books.externalRating,
	externalRatingCount: books.externalRatingCount,
	cover: books.cover,
	extension: books.extension,
	filesize: books.filesize,
	language: books.language,
	year: books.year,
	month: books.month,
	day: books.day,
	progressStorageKey: books.progressStorageKey,
	progressUpdatedAt: books.progressUpdatedAt,
	progressPercent: books.progressPercent,
	progressBeforeRead: books.progressBeforeRead,
	rating: books.rating,
	readAt: books.readAt,
	archivedAt: books.archivedAt,
	excludeFromNewBooks: books.excludeFromNewBooks,
	createdAt: books.createdAt,
	deletedAt: books.deletedAt,
	trashExpiresAt: books.trashExpiresAt
};

export const bookSelectionWithDownloadState = {
	...bookSelection,
	isDownloaded:
		sql<number>`exists (select 1 from ${deviceDownloads} where ${deviceDownloads.bookId} = ${books.id})`
};

export function mapBookRow(row: DbBookRow): Book {
	return {
		id: row.id,
		zLibId: row.zLibId,
		s3_storage_key: row.s3StorageKey,
		title: row.title,
		author: row.author,
		publisher: row.publisher,
		series: row.series,
		volume: row.volume,
		series_index: row.seriesIndex,
		edition: row.edition,
		identifier: row.identifier,
		pages: row.pages,
		description: row.description,
		google_books_id: row.googleBooksId,
		open_library_key: row.openLibraryKey,
		amazon_asin: row.amazonAsin,
		external_rating: row.externalRating,
		external_rating_count: row.externalRatingCount,
		cover: row.cover,
		extension: row.extension,
		filesize: row.filesize,
		language: row.language,
		year: row.year,
		month: row.month,
		day: row.day,
		progress_storage_key: row.progressStorageKey,
		progress_updated_at: row.progressUpdatedAt,
		progress_percent: row.progressPercent,
		progress_before_read: row.progressBeforeRead,
		rating: normalizeBookRating(row.rating),
		read_at: row.readAt,
		archived_at: row.archivedAt,
		exclude_from_new_books: row.excludeFromNewBooks,
		createdAt: row.createdAt,
		deleted_at: row.deletedAt,
		trash_expires_at: row.trashExpiresAt
	};
}

export function mapBookWithDownloadRow(row: DbBookWithDownloadRow): Book {
	return {
		...mapBookRow(row),
		isDownloaded: Boolean(row.isDownloaded)
	};
}

export function toCreateBookRow(book: CreateBookInput, createdAt: string) {
	return {
		zLibId: book.zLibId,
		s3StorageKey: book.s3_storage_key,
		title: book.title,
		author: book.author,
		publisher: book.publisher,
		series: book.series,
		volume: book.volume,
		seriesIndex: book.series_index,
		edition: book.edition,
		identifier: book.identifier,
		pages: book.pages,
		description: book.description,
		googleBooksId: book.google_books_id,
		openLibraryKey: book.open_library_key,
		amazonAsin: book.amazon_asin,
		externalRating: book.external_rating,
		externalRatingCount: book.external_rating_count,
		cover: book.cover,
		extension: book.extension,
		filesize: book.filesize,
		language: book.language,
		year: book.year,
		month: book.month,
		day: book.day,
		createdAt
	};
}

export function toUpdateBookMetadataRow(metadata: UpdateBookMetadataInput) {
	return {
		zLibId: metadata.zLibId,
		title: metadata.title,
		author: metadata.author,
		publisher: metadata.publisher,
		series: metadata.series,
		volume: metadata.volume,
		seriesIndex: metadata.series_index,
		edition: metadata.edition,
		identifier: metadata.identifier,
		pages: metadata.pages,
		description: metadata.description,
		googleBooksId: metadata.google_books_id,
		openLibraryKey: metadata.open_library_key,
		amazonAsin: metadata.amazon_asin,
		externalRating: metadata.external_rating,
		externalRatingCount: metadata.external_rating_count,
		cover: metadata.cover,
		extension: metadata.extension,
		filesize: metadata.filesize,
		language: metadata.language,
		year: metadata.year,
		month: metadata.month,
		day: metadata.day,
		createdAt: metadata.createdAt
	};
}

function normalizeBookRating(rating: number | null): number | null {
	return typeof rating === 'number' && rating >= 1 && rating <= 5 ? rating : null;
}
