import type { BookProgressHistoryRepositoryPort } from '$lib/server/application/ports/BookProgressHistoryRepositoryPort';
import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface GetBookProgressHistoryInput {
	bookId: number;
}

interface GetBookProgressHistoryResult {
	success: true;
	bookId: number;
	history: Array<{
		progressPercent: number;
		recordedAt: string;
	}>;
}

export class GetBookProgressHistoryUseCase {
	constructor(
		private readonly bookRepository: BookRepositoryPort,
		private readonly progressHistoryRepository: BookProgressHistoryRepositoryPort
	) {}

	async execute(
		input: GetBookProgressHistoryInput
	): Promise<ApiResult<GetBookProgressHistoryResult>> {
		const book = await this.bookRepository.getById(input.bookId);
		if (!book) {
			return apiError('Book not found', 404);
		}

		const history = await this.progressHistoryRepository.getByBookId(input.bookId);
		return apiOk({
			success: true,
			bookId: input.bookId,
			history: history.map((entry) => ({
				progressPercent: Math.max(0, Math.min(100, entry.progressPercent * 100)),
				recordedAt: entry.recordedAt
			}))
		});
	}
}

