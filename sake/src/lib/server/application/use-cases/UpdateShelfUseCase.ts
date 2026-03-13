import type { ShelfRepositoryPort } from '$lib/server/application/ports/ShelfRepositoryPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import type { RuleGroup } from '$lib/types/Library/ShelfRule';

interface UpdateShelfInput {
	shelfId: number;
	name: string;
	icon?: string;
}

interface UpdateShelfResult {
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

function normalizeShelfName(name: string): string {
	return name.trim();
}

function normalizeShelfIcon(icon?: string): string {
	const trimmed = (icon ?? '').trim();
	return trimmed.length > 0 ? trimmed : '📚';
}

export class UpdateShelfUseCase {
	constructor(private readonly shelfRepository: ShelfRepositoryPort) {}

	async execute(input: UpdateShelfInput): Promise<ApiResult<UpdateShelfResult>> {
		const name = normalizeShelfName(input.name);
		if (!name) {
			return apiError('Shelf name is required', 400);
		}
		if (name.length > 80) {
			return apiError('Shelf name is too long', 400);
		}

		const existing = await this.shelfRepository.getById(input.shelfId);
		if (!existing) {
			return apiError('Shelf not found', 404);
		}

		const shelf = await this.shelfRepository.update(input.shelfId, {
			name,
			icon: normalizeShelfIcon(input.icon),
			ruleGroup: existing.ruleGroup
		});

		if (!shelf) {
			return apiError('Shelf not found', 404);
		}

		return apiOk({
			success: true,
			shelf
		});
	}
}
