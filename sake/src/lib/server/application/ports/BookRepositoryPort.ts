import type {
	Book,
	CreateBookInput,
	UpdateBookMetadataInput
} from '$lib/server/domain/entities/Book';

export interface BookRepositoryPort {
	getAll(): Promise<Book[]>;
	getAllForStats(): Promise<Book[]>;
	getById(id: number): Promise<Book | undefined>;
	getByIdIncludingTrashed(id: number): Promise<Book | undefined>;
	getByZLibId(zLibId: string): Promise<Book | undefined>;
	getByStorageKey(storageKey: string): Promise<Book | undefined>;
	getByTitleAndExtension(title: string, extension: string): Promise<Book | undefined>;
	getByTitle(title: string): Promise<Book | undefined>;
	create(book: CreateBookInput): Promise<Book>;
	updateMetadata(id: number, metadata: UpdateBookMetadataInput): Promise<Book>;
	delete(id: number): Promise<void>;
	resetDownloadStatus(bookId: number): Promise<void>;
	updateProgress(bookId: number, progressKey: string, progressPercent: number | null): Promise<void>;
	updateRating(bookId: number, rating: number | null): Promise<void>;
	updateState(
		bookId: number,
		state: {
			readAt?: string | null;
			archivedAt?: string | null;
			progressPercent?: number | null;
			progressBeforeRead?: number | null;
			excludeFromNewBooks?: boolean;
		}
	): Promise<void>;
	getNotDownloadedByDevice(deviceId: string): Promise<Book[]>;
	getBooksWithNewProgressForDevice(deviceId: string): Promise<Book[]>;
	getTrashed(): Promise<Book[]>;
	moveToTrash(id: number, deletedAt: string, trashExpiresAt: string): Promise<void>;
	restoreFromTrash(id: number): Promise<void>;
	getExpiredTrash(nowIso: string): Promise<Book[]>;
	count(): Promise<number>;
}
