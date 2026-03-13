import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import { apiOk, type ApiResult } from '$lib/server/http/api';

interface RatedBook {
	id: number;
	title: string;
	author: string | null;
	extension: string | null;
	rating: number;
}

interface ListLibraryRatingsResult {
	success: true;
	books: RatedBook[];
}

export class ListLibraryRatingsUseCase {
	constructor(private readonly bookRepository: BookRepositoryPort) {}

	async execute(): Promise<ApiResult<ListLibraryRatingsResult>> {
		const books = await this.bookRepository.getAll();
		const ratedBooks: RatedBook[] = books
			.filter((book) => typeof book.rating === 'number' && book.rating >= 1)
			.map((book) => ({
				id: book.id,
				title: book.title,
				author: book.author,
				extension: book.extension,
				rating: book.rating as number
			}))
			.sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title));

		return apiOk({ success: true, books: ratedBooks });
	}
}
