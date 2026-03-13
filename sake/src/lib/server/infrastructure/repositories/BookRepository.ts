import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type {
	Book,
	CreateBookInput,
	UpdateBookMetadataInput
} from '$lib/server/domain/entities/Book';
import { drizzleDb } from '$lib/server/infrastructure/db/client';
import { books, deviceDownloads, deviceProgressDownloads } from '$lib/server/infrastructure/db/schema';
import { createChildLogger } from '$lib/server/infrastructure/logging/logger';
import { and, desc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';

type DbBookRow = {
	id: number;
	s3StorageKey: string;
	title: string;
	zLibId: string | null;
	author: string | null;
	publisher: string | null;
	series: string | null;
	volume: string | null;
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

type DbBookWithDownloadRow = DbBookRow & {
	isDownloaded: number | boolean;
};

const bookSelection = {
	id: books.id,
	s3StorageKey: books.s3StorageKey,
	title: books.title,
	zLibId: books.zLibId,
	author: books.author,
	publisher: books.publisher,
	series: books.series,
	volume: books.volume,
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

function mapBookRow(row: DbBookRow): Book {
	return {
		id: row.id,
		zLibId: row.zLibId,
		s3_storage_key: row.s3StorageKey,
		title: row.title,
		author: row.author,
		publisher: row.publisher,
		series: row.series,
		volume: row.volume,
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
		progress_storage_key: row.progressStorageKey,
		progress_updated_at: row.progressUpdatedAt,
		progress_percent: row.progressPercent,
		progress_before_read: row.progressBeforeRead,
		rating: typeof row.rating === 'number' && row.rating >= 1 && row.rating <= 5 ? row.rating : null,
		read_at: row.readAt,
		archived_at: row.archivedAt,
		exclude_from_new_books: row.excludeFromNewBooks,
		createdAt: row.createdAt,
		deleted_at: row.deletedAt,
		trash_expires_at: row.trashExpiresAt
	};
}

function mapBookWithDownloadRow(row: DbBookWithDownloadRow): Book {
	return {
		...mapBookRow(row),
		isDownloaded: Boolean(row.isDownloaded)
	};
}

export class BookRepository implements BookRepositoryPort {
	private static readonly instance = new BookRepository();
	private readonly repoLogger = createChildLogger({ repository: 'BookRepository' });

	async getAll(): Promise<Book[]> {
		const rows = await drizzleDb
			.select({
				...bookSelection,
				isDownloaded:
					sql<number>`exists (select 1 from ${deviceDownloads} where ${deviceDownloads.bookId} = ${books.id})`
			})
			.from(books)
			.where(isNull(books.deletedAt))
			.orderBy(desc(books.createdAt));

		return rows.map((row) => mapBookWithDownloadRow(row));
	}

	async getAllForStats(): Promise<Book[]> {
		const rows = await drizzleDb
			.select(bookSelection)
			.from(books)
			.orderBy(desc(books.createdAt));

		return rows.map((row) => mapBookRow(row));
	}

	async getById(id: number): Promise<Book | undefined> {
		const [row] = await drizzleDb
			.select(bookSelection)
			.from(books)
			.where(and(eq(books.id, id), isNull(books.deletedAt)))
			.limit(1);
		return row ? mapBookRow(row) : undefined;
	}

	async getByIdIncludingTrashed(id: number): Promise<Book | undefined> {
		const [row] = await drizzleDb.select(bookSelection).from(books).where(eq(books.id, id)).limit(1);
		return row ? mapBookRow(row) : undefined;
	}

	async getByZLibId(zLibId: string): Promise<Book | undefined> {
		const [row] = await drizzleDb
			.select(bookSelection)
			.from(books)
			.where(and(eq(books.zLibId, zLibId), isNull(books.deletedAt)))
			.limit(1);
		return row ? mapBookRow(row) : undefined;
	}

	async getByStorageKey(storageKey: string): Promise<Book | undefined> {
		const [row] = await drizzleDb
			.select(bookSelection)
			.from(books)
			.where(and(eq(books.s3StorageKey, storageKey), isNull(books.deletedAt)))
			.limit(1);
		return row ? mapBookRow(row) : undefined;
	}

	async getByTitleAndExtension(title: string, extension: string): Promise<Book | undefined> {
		const [row] = await drizzleDb
			.select(bookSelection)
			.from(books)
			.where(and(eq(books.title, title), eq(books.extension, extension), isNull(books.deletedAt)))
			.limit(1);
		return row ? mapBookRow(row) : undefined;
	}

	async getByTitle(title: string): Promise<Book | undefined> {
		const [row] = await drizzleDb
			.select(bookSelection)
			.from(books)
			.where(and(eq(books.title, title), isNull(books.deletedAt)))
			.limit(1);
		return row ? mapBookRow(row) : undefined;
	}

	async create(book: CreateBookInput): Promise<Book> {
		const [created] = await drizzleDb
			.insert(books)
			.values({
				zLibId: book.zLibId,
				s3StorageKey: book.s3_storage_key,
				title: book.title,
				author: book.author,
				publisher: book.publisher,
				series: book.series,
				volume: book.volume,
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
				year: book.year
			})
			.returning(bookSelection);

		if (!created) {
			throw new Error('Failed to create book');
		}

		this.repoLogger.info(
			{ event: 'book.created', id: created.id, zLibId: created.zLibId, storageKey: created.s3StorageKey },
			'Book row inserted'
		);

		return mapBookRow(created);
	}

	async updateMetadata(id: number, metadata: UpdateBookMetadataInput): Promise<Book> {
		const [updated] = await drizzleDb
			.update(books)
			.set({
				zLibId: metadata.zLibId,
				title: metadata.title,
				author: metadata.author,
				publisher: metadata.publisher,
				series: metadata.series,
				volume: metadata.volume,
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
				year: metadata.year
			})
			.where(eq(books.id, id))
			.returning(bookSelection);

		if (!updated) {
			throw new Error('Failed to update book metadata');
		}

		this.repoLogger.info(
			{ event: 'book.metadata.updated', id, zLibId: updated.zLibId, storageKey: updated.s3StorageKey },
			'Book metadata updated'
		);

		return mapBookRow(updated);
	}

	async delete(id: number): Promise<void> {
		await drizzleDb.delete(books).where(eq(books.id, id));
		this.repoLogger.info({ event: 'book.deleted', id }, 'Book row deleted');
	}

	async resetDownloadStatus(bookId: number): Promise<void> {
		await drizzleDb.delete(deviceDownloads).where(eq(deviceDownloads.bookId, bookId));
		this.repoLogger.info({ event: 'book.downloadStatus.reset', bookId }, 'Book download status reset');
	}

	async updateProgress(bookId: number, progressKey: string, progressPercent: number | null): Promise<void> {
		const readAtValue =
			typeof progressPercent === 'number' && progressPercent >= 1 ? sql`CURRENT_TIMESTAMP` : null;
		await drizzleDb
			.update(books)
			.set({
				progressStorageKey: progressKey,
				progressUpdatedAt: sql`CURRENT_TIMESTAMP`,
				progressPercent,
				progressBeforeRead: null,
				readAt: readAtValue
			})
			.where(eq(books.id, bookId));
		this.repoLogger.info(
			{
				event: 'book.progress.updated',
				bookId,
				progressStorageKey: progressKey,
				progressPercent,
				readAt: readAtValue === null ? null : 'CURRENT_TIMESTAMP'
			},
			'Book progress reference updated'
		);
	}

	async updateRating(bookId: number, rating: number | null): Promise<void> {
		await drizzleDb
			.update(books)
			.set({ rating })
			.where(eq(books.id, bookId));
		this.repoLogger.info({ event: 'book.rating.updated', bookId, rating }, 'Book rating updated');
	}

	async updateState(
		bookId: number,
		state: {
			readAt?: string | null;
			archivedAt?: string | null;
			progressPercent?: number | null;
			progressBeforeRead?: number | null;
			excludeFromNewBooks?: boolean;
		}
	): Promise<void> {
		const updates: {
			readAt?: string | null;
			archivedAt?: string | null;
			progressPercent?: number | null;
			progressBeforeRead?: number | null;
			excludeFromNewBooks?: boolean;
		} = {};
		if (state.readAt !== undefined) {
			updates.readAt = state.readAt;
		}
		if (state.archivedAt !== undefined) {
			updates.archivedAt = state.archivedAt;
		}
		if (state.progressPercent !== undefined) {
			updates.progressPercent = state.progressPercent;
		}
		if (state.progressBeforeRead !== undefined) {
			updates.progressBeforeRead = state.progressBeforeRead;
		}
		if (state.excludeFromNewBooks !== undefined) {
			updates.excludeFromNewBooks = state.excludeFromNewBooks;
		}

		await drizzleDb.update(books).set(updates).where(eq(books.id, bookId));
		this.repoLogger.info(
			{ event: 'book.state.updated', bookId, ...updates },
			'Book state updated'
		);
	}

	async getNotDownloadedByDevice(deviceId: string): Promise<Book[]> {
		const rows = await drizzleDb
			.select(bookSelection)
			.from(books)
			.leftJoin(
				deviceDownloads,
				and(eq(books.id, deviceDownloads.bookId), eq(deviceDownloads.deviceId, deviceId))
			)
			.where(
				and(
					isNull(deviceDownloads.bookId),
					isNull(books.deletedAt),
					isNull(books.archivedAt),
					eq(books.excludeFromNewBooks, false)
				)
			)
			.orderBy(desc(books.createdAt));

		return rows.map((row) => mapBookRow(row));
	}

	async getBooksWithNewProgressForDevice(deviceId: string): Promise<Book[]> {
		const rows = await drizzleDb
			.select(bookSelection)
			.from(books)
			.leftJoin(
				deviceProgressDownloads,
				and(
					eq(books.id, deviceProgressDownloads.bookId),
					eq(deviceProgressDownloads.deviceId, deviceId)
				)
			)
			.where(
				and(
					isNull(books.deletedAt),
					isNotNull(books.progressStorageKey),
					isNotNull(books.progressUpdatedAt),
					or(
						isNull(deviceProgressDownloads.id),
						sql`${deviceProgressDownloads.progressUpdatedAt} < ${books.progressUpdatedAt}`
					)
				)
			)
			.orderBy(desc(books.progressUpdatedAt), desc(books.createdAt));

		return rows.map((row) => mapBookRow(row));
	}

	async getTrashed(): Promise<Book[]> {
		const rows = await drizzleDb
			.select(bookSelection)
			.from(books)
			.where(isNotNull(books.deletedAt))
			.orderBy(desc(books.deletedAt), desc(books.createdAt));
		return rows.map((row) => mapBookRow(row));
	}

	async moveToTrash(id: number, deletedAt: string, trashExpiresAt: string): Promise<void> {
		await drizzleDb
			.update(books)
			.set({
				deletedAt,
				trashExpiresAt
			})
			.where(and(eq(books.id, id), isNull(books.deletedAt)));
		this.repoLogger.info(
			{ event: 'book.trashed', id, deletedAt, trashExpiresAt },
			'Book moved to trash'
		);
	}

	async restoreFromTrash(id: number): Promise<void> {
		await drizzleDb
			.update(books)
			.set({
				deletedAt: null,
				trashExpiresAt: null
			})
			.where(and(eq(books.id, id), isNotNull(books.deletedAt)));
		this.repoLogger.info({ event: 'book.restored', id }, 'Book restored from trash');
	}

	async getExpiredTrash(nowIso: string): Promise<Book[]> {
		const rows = await drizzleDb
			.select(bookSelection)
			.from(books)
			.where(
				and(
					isNotNull(books.deletedAt),
					isNotNull(books.trashExpiresAt),
					sql`${books.trashExpiresAt} <= ${nowIso}`
				)
			);
		return rows.map((row) => mapBookRow(row));
	}

	async count(): Promise<number> {
		const [result] = await drizzleDb
			.select({ count: sql<number>`count(*)` })
			.from(books)
			.where(isNull(books.deletedAt));
		return Number(result?.count ?? 0);
	}

	static async getAll(): Promise<Book[]> {
		return BookRepository.instance.getAll();
	}

	static async getAllForStats(): Promise<Book[]> {
		return BookRepository.instance.getAllForStats();
	}

	static async getById(id: number): Promise<Book | undefined> {
		return BookRepository.instance.getById(id);
	}

	static async getByIdIncludingTrashed(id: number): Promise<Book | undefined> {
		return BookRepository.instance.getByIdIncludingTrashed(id);
	}

	static async getByZLibId(zLibId: string): Promise<Book | undefined> {
		return BookRepository.instance.getByZLibId(zLibId);
	}

	static async getByStorageKey(storageKey: string): Promise<Book | undefined> {
		return BookRepository.instance.getByStorageKey(storageKey);
	}

	static async getByTitleAndExtension(title: string, extension: string): Promise<Book | undefined> {
		return BookRepository.instance.getByTitleAndExtension(title, extension);
	}

	static async getByTitle(title: string): Promise<Book | undefined> {
		return BookRepository.instance.getByTitle(title);
	}

	static async create(book: CreateBookInput): Promise<Book> {
		return BookRepository.instance.create(book);
	}

	static async updateMetadata(id: number, metadata: UpdateBookMetadataInput): Promise<Book> {
		return BookRepository.instance.updateMetadata(id, metadata);
	}

	static async delete(id: number): Promise<void> {
		return BookRepository.instance.delete(id);
	}

	static async resetDownloadStatus(bookId: number): Promise<void> {
		return BookRepository.instance.resetDownloadStatus(bookId);
	}

	static async updateProgress(
		bookId: number,
		progressKey: string,
		progressPercent: number | null
	): Promise<void> {
		return BookRepository.instance.updateProgress(bookId, progressKey, progressPercent);
	}

	static async updateRating(bookId: number, rating: number | null): Promise<void> {
		return BookRepository.instance.updateRating(bookId, rating);
	}

	static async updateState(
		bookId: number,
		state: {
			readAt?: string | null;
			progressPercent?: number | null;
			progressBeforeRead?: number | null;
			excludeFromNewBooks?: boolean;
		}
	): Promise<void> {
		return BookRepository.instance.updateState(bookId, state);
	}

	static async getNotDownloadedByDevice(deviceId: string): Promise<Book[]> {
		return BookRepository.instance.getNotDownloadedByDevice(deviceId);
	}

	static async getBooksWithNewProgressForDevice(deviceId: string): Promise<Book[]> {
		return BookRepository.instance.getBooksWithNewProgressForDevice(deviceId);
	}

	static async getTrashed(): Promise<Book[]> {
		return BookRepository.instance.getTrashed();
	}

	static async moveToTrash(id: number, deletedAt: string, trashExpiresAt: string): Promise<void> {
		return BookRepository.instance.moveToTrash(id, deletedAt, trashExpiresAt);
	}

	static async restoreFromTrash(id: number): Promise<void> {
		return BookRepository.instance.restoreFromTrash(id);
	}

	static async getExpiredTrash(nowIso: string): Promise<Book[]> {
		return BookRepository.instance.getExpiredTrash(nowIso);
	}

	static async count(): Promise<number> {
		return BookRepository.instance.count();
	}
}
