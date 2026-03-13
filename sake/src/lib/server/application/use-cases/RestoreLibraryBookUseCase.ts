import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface RestoreLibraryBookInput {
	bookId: number;
}

interface RestoreLibraryBookResult {
	success: true;
	bookId: number;
}

export class RestoreLibraryBookUseCase {
	constructor(private readonly bookRepository: BookRepositoryPort) {}

	async execute(input: RestoreLibraryBookInput): Promise<ApiResult<RestoreLibraryBookResult>> {
		const book = await this.bookRepository.getByIdIncludingTrashed(input.bookId);
		if (!book) {
			return apiError('Book not found', 404);
		}

		if (!book.deleted_at) {
			return apiError('Book is not in trash', 400);
		}

		await this.bookRepository.restoreFromTrash(input.bookId);
		return apiOk({ success: true, bookId: input.bookId });
	}
}
