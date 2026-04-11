import type { UserRepositoryPort } from '$lib/server/application/ports/UserRepositoryPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface GetCurrentUserInput {
	userId: number;
}

interface GetCurrentUserResult {
	success: true;
	user: {
		id: number;
		username: string;
		isDisabled: boolean;
		hasBasicAuthPassword: boolean;
		lastLoginAt: string | null;
		createdAt: string;
	};
}

export class GetCurrentUserUseCase {
	constructor(private readonly userRepository: UserRepositoryPort) {}

	async execute(input: GetCurrentUserInput): Promise<ApiResult<GetCurrentUserResult>> {
		const user = await this.userRepository.getById(input.userId);
		if (!user) {
			return apiError('User not found', 404);
		}

		return apiOk({
			success: true,
			user: {
				id: user.id,
				username: user.username,
				isDisabled: user.isDisabled,
				hasBasicAuthPassword: Boolean(user.basicAuthPasswordHash),
				lastLoginAt: user.lastLoginAt,
				createdAt: user.createdAt
			}
		});
	}
}
