import type { UserRepositoryPort } from '$lib/server/application/ports/UserRepositoryPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface ClearBasicAuthPasswordInput {
	userId: number;
}

interface ClearBasicAuthPasswordResult {
	success: true;
	hasBasicAuthPassword: false;
}

export class ClearBasicAuthPasswordUseCase {
	constructor(private readonly userRepository: UserRepositoryPort) {}

	async execute(
		input: ClearBasicAuthPasswordInput
	): Promise<ApiResult<ClearBasicAuthPasswordResult>> {
		const user = await this.userRepository.getById(input.userId);
		if (!user) {
			return apiError('User not found', 404);
		}

		await this.userRepository.setBasicAuthPasswordHash(
			input.userId,
			null,
			new Date().toISOString()
		);

		return apiOk({
			success: true,
			hasBasicAuthPassword: false
		});
	}
}
