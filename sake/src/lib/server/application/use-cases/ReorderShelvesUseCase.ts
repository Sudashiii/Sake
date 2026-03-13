import type { ShelfRepositoryPort } from '$lib/server/application/ports/ShelfRepositoryPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import type { RuleGroup } from '$lib/types/Library/ShelfRule';

interface ReorderShelvesInput {
	shelfIds: number[];
}

interface ReorderShelvesResult {
	success: true;
	shelves: {
		id: number;
		name: string;
		icon: string;
		sortOrder: number;
		ruleGroup: RuleGroup;
		createdAt: string;
		updatedAt: string;
	}[];
}

export class ReorderShelvesUseCase {
	constructor(private readonly shelfRepository: ShelfRepositoryPort) {}

	async execute(input: ReorderShelvesInput): Promise<ApiResult<ReorderShelvesResult>> {
		const shelfIds = input.shelfIds;
		if (shelfIds.length === 0) {
			return apiError('shelfIds must not be empty', 400);
		}
		if (new Set(shelfIds).size !== shelfIds.length) {
			return apiError('shelfIds must not contain duplicates', 400);
		}

		const existingShelves = await this.shelfRepository.list();
		if (existingShelves.length === 0) {
			return apiError('No shelves available to reorder', 400);
		}

		if (shelfIds.length !== existingShelves.length) {
			return apiError('shelfIds must contain all shelves exactly once', 400);
		}

		const existingIds = new Set(existingShelves.map((shelf) => shelf.id));
		const invalidIds = shelfIds.filter((id) => !existingIds.has(id));
		if (invalidIds.length > 0) {
			return apiError(`Shelf not found: ${invalidIds.join(', ')}`, 400);
		}

		await this.shelfRepository.reorder(shelfIds);
		const shelves = await this.shelfRepository.list();

		return apiOk({
			success: true,
			shelves
		});
	}
}
