import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { ShelfRepositoryPort } from '$lib/server/application/ports/ShelfRepositoryPort';
import { apiOk, type ApiResult } from '$lib/server/http/api';
import type { Book } from '$lib/server/domain/entities/Book';

interface LibraryBookWithProgress extends Book {
	progressPercent: number | null;
	shelfIds: number[];
}

interface ListLibraryResult {
	success: true;
	books: LibraryBookWithProgress[];
}

export class ListLibraryUseCase {
	constructor(
		private readonly bookRepository: BookRepositoryPort,
		private readonly shelfRepository: ShelfRepositoryPort
	) {}

	async execute(): Promise<ApiResult<ListLibraryResult>> {
		const books = await this.bookRepository.getAll();
		const shelfIdsByBookId = await this.shelfRepository.getBookShelfIdsForBooks(
			books.map((book) => book.id)
		);
		const withProgress = books.map((book: Book) => ({
			...book,
			progressPercent:
				typeof book.progress_percent === 'number'
					? Math.max(0, Math.min(100, book.progress_percent * 100))
					: null,
			shelfIds: shelfIdsByBookId[book.id] ?? []
		}));
		return apiOk({ success: true, books: withProgress });
	}
}
