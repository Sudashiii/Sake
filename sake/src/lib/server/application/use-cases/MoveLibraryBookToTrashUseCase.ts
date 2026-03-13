import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface MoveLibraryBookToTrashInput {
	bookId: number;
}

interface MoveLibraryBookToTrashResult {
	success: true;
	bookId: number;
	trashExpiresAt: string;
}

const TRASH_RETENTION_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export class MoveLibraryBookToTrashUseCase {
	constructor(private readonly bookRepository: BookRepositoryPort) {}

	async execute(input: MoveLibraryBookToTrashInput): Promise<ApiResult<MoveLibraryBookToTrashResult>> {
		const book = await this.bookRepository.getById(input.bookId);
		if (!book) {
			return apiError('Book not found', 404);
		}

		const deletedAt = new Date().toISOString();
		const trashExpiresAt = new Date(Date.now() + TRASH_RETENTION_DAYS * DAY_IN_MS).toISOString();
		await this.bookRepository.moveToTrash(input.bookId, deletedAt, trashExpiresAt);

		return apiOk({
			success: true,
			bookId: input.bookId,
			trashExpiresAt
		});
	}
}
