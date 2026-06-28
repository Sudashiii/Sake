import type { BookProgressHistory } from '$lib/server/domain/entities/BookProgressHistory';

export interface CreateBookProgressHistorySnapshot {
	bookId: number;
	progressPercent: number;
}

export interface BookProgressHistoryRepositoryPort {
	appendSnapshot(input: CreateBookProgressHistorySnapshot): Promise<BookProgressHistory>;
	upsertReaderSessionSnapshot(
		input: CreateBookProgressHistorySnapshot & { readerSessionId: string }
	): Promise<BookProgressHistory>;
	getByBookId(bookId: number): Promise<BookProgressHistory[]>;
}
