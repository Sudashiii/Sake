import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { ShelfRepositoryPort } from '$lib/server/application/ports/ShelfRepositoryPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface SetBookShelvesInput {
	bookId: number;
	shelfIds: number[];
}

interface SetBookShelvesResult {
	success: true;
	bookId: number;
	shelfIds: number[];
}

function normalizeShelfIds(shelfIds: number[]): number[] {
	return [...new Set(shelfIds.filter((value) => Number.isInteger(value) && value > 0))].sort(
		(a, b) => a - b
	);
}

export class SetBookShelvesUseCase {
	constructor(
		private readonly bookRepository: BookRepositoryPort,
		private readonly shelfRepository: ShelfRepositoryPort
	) {}

	async execute(input: SetBookShelvesInput): Promise<ApiResult<SetBookShelvesResult>> {
		const book = await this.bookRepository.getById(input.bookId);
		if (!book) {
			return apiError('Book not found', 404);
		}

		if (!input.shelfIds.every((value) => Number.isInteger(value) && value > 0)) {
			return apiError('shelfIds must contain positive integer IDs only', 400);
		}
		const normalizedShelfIds = normalizeShelfIds(input.shelfIds);

		if (normalizedShelfIds.length > 0) {
			const shelves = await this.shelfRepository.listByIds(normalizedShelfIds);
			if (shelves.length !== normalizedShelfIds.length) {
				const existingIds = new Set(shelves.map((shelf) => shelf.id));
				const missingIds = normalizedShelfIds.filter((id) => !existingIds.has(id));
				return apiError(`Shelf not found: ${missingIds.join(', ')}`, 400);
			}
		}

		await this.shelfRepository.setBookShelfIds(input.bookId, normalizedShelfIds);

		return apiOk({
			success: true,
			bookId: input.bookId,
			shelfIds: normalizedShelfIds
		});
	}
}
