import type { ShelfRepositoryPort } from '$lib/server/application/ports/ShelfRepositoryPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface DeleteShelfInput {
	shelfId: number;
}

interface DeleteShelfResult {
	success: true;
	shelfId: number;
}

export class DeleteShelfUseCase {
	constructor(private readonly shelfRepository: ShelfRepositoryPort) {}

	async execute(input: DeleteShelfInput): Promise<ApiResult<DeleteShelfResult>> {
		const existing = await this.shelfRepository.getById(input.shelfId);
		if (!existing) {
			return apiError('Shelf not found', 404);
		}

		await this.shelfRepository.delete(input.shelfId);
		return apiOk({
			success: true,
			shelfId: input.shelfId
		});
	}
}
