import type { ShelfRepositoryPort } from '$lib/server/application/ports/ShelfRepositoryPort';
import { apiOk, type ApiResult } from '$lib/server/http/api';
import type { RuleGroup } from '$lib/types/Library/ShelfRule';

interface ListShelvesResult {
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

export class ListShelvesUseCase {
	constructor(private readonly shelfRepository: ShelfRepositoryPort) {}

	async execute(): Promise<ApiResult<ListShelvesResult>> {
		const shelves = await this.shelfRepository.list();
		return apiOk({
			success: true,
			shelves
		});
	}
}
