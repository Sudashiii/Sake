import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type {
	Book,
	CreateBookInput,
	UpdateBookMetadataInput
} from '$lib/server/domain/entities/Book';
import { drizzleDb } from '$lib/server/infrastructure/db/client';
import { books, deviceDownloads, deviceProgressDownloads } from '$lib/server/infrastructure/db/schema';
import { createChildLogger } from '$lib/server/infrastructure/logging/logger';
import {
	bookSelection,
	bookSelectionWithDownloadState,
	mapBookRow,
	mapBookWithDownloadRow,
	toCreateBookRow,
	toUpdateBookMetadataRow
} from './BookRepository.helpers';
import { and, desc, eq, inArray, isNotNull, isNull, ne, notInArray, or, sql } from 'drizzle-orm';

export class BookRepository implements BookRepositoryPort {
	private readonly repoLogger = createChildLogger({ repository: 'BookRepository' });

	async getAll(): Promise<Book[]> {
		const rows = await drizzleDb
			.select(bookSelectionWithDownloadState)
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

	async getByZLibIdIncludingTrashed(zLibId: string): Promise<Book | undefined> {
		const active = await this.getByZLibId(zLibId);
		if (active) {
			return active;
		}

		const [row] = await drizzleDb
			.select(bookSelection)
			.from(books)
			.where(and(eq(books.zLibId, zLibId), isNotNull(books.deletedAt)))
			.orderBy(desc(books.deletedAt), desc(books.id))
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

	async getByStorageKeyIncludingTrashed(storageKey: string): Promise<Book | undefined> {
		const active = await this.getByStorageKey(storageKey);
		if (active) {
			return active;
		}

		const [row] = await drizzleDb
			.select(bookSelection)
			.from(books)
			.where(and(eq(books.s3StorageKey, storageKey), isNotNull(books.deletedAt)))
			.orderBy(desc(books.deletedAt), desc(books.id))
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

	async hasOtherBookWithStorageKey(storageKey: string, excludeBookId: number): Promise<boolean> {
		const [row] = await drizzleDb
			.select({ id: books.id })
			.from(books)
			.where(and(eq(books.s3StorageKey, storageKey), ne(books.id, excludeBookId)))
			.limit(1);
		return row !== undefined;
	}

	async listStorageKeysWithExternalReferences(
		storageKeys: string[],
		excludeBookIds: number[]
	): Promise<string[]> {
		const uniqueStorageKeys = [...new Set(storageKeys)];
		if (uniqueStorageKeys.length === 0) {
			return [];
		}

		const whereClause =
			excludeBookIds.length > 0
				? and(
						inArray(books.s3StorageKey, uniqueStorageKeys),
						notInArray(books.id, excludeBookIds)
					)
				: inArray(books.s3StorageKey, uniqueStorageKeys);
		const rows = await drizzleDb
			.selectDistinct({ storageKey: books.s3StorageKey })
			.from(books)
			.where(whereClause);
		return rows.map((row) => row.storageKey);
	}

	async create(book: CreateBookInput): Promise<Book> {
		const createdAt = new Date().toISOString();
		const [created] = await drizzleDb
			.insert(books)
			.values(toCreateBookRow(book, createdAt))
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
			.set(toUpdateBookMetadataRow(metadata))
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

	async updateProgress(
		bookId: number,
		progressKey: string,
		progressPercent: number | null,
		progressUpdatedAt?: string | null
	): Promise<void> {
		const progressUpdatedAtValue =
			typeof progressUpdatedAt === 'string' && progressUpdatedAt.trim().length > 0
				? progressUpdatedAt.trim()
				: sql`CURRENT_TIMESTAMP`;
		const readAtValue =
			typeof progressPercent === 'number' && progressPercent >= 1 ? progressUpdatedAtValue : null;
		await drizzleDb
			.update(books)
			.set({
				progressStorageKey: progressKey,
				progressUpdatedAt: progressUpdatedAtValue,
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
				progressUpdatedAt:
					typeof progressUpdatedAtValue === 'string' ? progressUpdatedAtValue : 'CURRENT_TIMESTAMP',
				readAt: readAtValue === null ? null : typeof readAtValue === 'string' ? readAtValue : 'CURRENT_TIMESTAMP'
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
}
