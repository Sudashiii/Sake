import type { BookProgressHistory } from '$lib/server/domain/entities/BookProgressHistory';

export interface BookProgressHistoryRepositoryPort {
	appendSnapshot(input: Omit<BookProgressHistory, 'id' | 'recordedAt'>): Promise<BookProgressHistory>;
	getByBookId(bookId: number): Promise<BookProgressHistory[]>;
}

