import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface UpdateBookRatingInput {
	bookId: number;
	rating: number | null;
}

interface UpdateBookRatingResult {
	success: true;
	bookId: number;
	rating: number | null;
}

export class UpdateBookRatingUseCase {
	constructor(private readonly bookRepository: BookRepositoryPort) {}

	async execute(input: UpdateBookRatingInput): Promise<ApiResult<UpdateBookRatingResult>> {
		if (input.rating !== null && (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)) {
			return apiError('rating must be null (unrated) or an integer between 1 and 5', 400);
		}

		const book = await this.bookRepository.getById(input.bookId);
		if (!book) {
			return apiError('Book not found', 404);
		}

		await this.bookRepository.updateRating(input.bookId, input.rating);
		return apiOk({ success: true, bookId: input.bookId, rating: input.rating });
	}
}
