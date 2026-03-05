import type { ShelfRepositoryPort } from '$lib/server/application/ports/ShelfRepositoryPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import type { RuleGroup } from '$lib/types/Library/ShelfRule';

interface UpdateShelfRulesInput {
	shelfId: number;
	ruleGroup: RuleGroup;
}

interface UpdateShelfRulesResult {
	success: true;
	shelf: {
		id: number;
		name: string;
		icon: string;
		sortOrder: number;
		ruleGroup: RuleGroup;
		createdAt: string;
		updatedAt: string;
	};
}

export class UpdateShelfRulesUseCase {
	constructor(private readonly shelfRepository: ShelfRepositoryPort) {}

	async execute(input: UpdateShelfRulesInput): Promise<ApiResult<UpdateShelfRulesResult>> {
		const existing = await this.shelfRepository.getById(input.shelfId);
		if (!existing) {
			return apiError('Shelf not found', 404);
		}

		const updated = await this.shelfRepository.update(input.shelfId, {
			name: existing.name,
			icon: existing.icon,
			ruleGroup: input.ruleGroup
		});

		if (!updated) {
			return apiError('Shelf not found', 404);
		}

		return apiOk({
			success: true,
			shelf: updated
		});
	}
}
