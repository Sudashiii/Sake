import type { ShelfRepositoryPort } from '$lib/server/application/ports/ShelfRepositoryPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface CreateShelfInput {
	name: string;
	icon?: string;
}

interface CreateShelfResult {
	success: true;
	shelf: {
		id: number;
		name: string;
		icon: string;
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

export class CreateShelfUseCase {
	constructor(private readonly shelfRepository: ShelfRepositoryPort) {}

	async execute(input: CreateShelfInput): Promise<ApiResult<CreateShelfResult>> {
		const name = normalizeShelfName(input.name);
		if (!name) {
			return apiError('Shelf name is required', 400);
		}
		if (name.length > 80) {
			return apiError('Shelf name is too long', 400);
		}

		const shelf = await this.shelfRepository.create({
			name,
			icon: normalizeShelfIcon(input.icon)
		});

		return apiOk({
			success: true,
			shelf
		});
	}
}
