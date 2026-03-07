import type { UserRepositoryPort } from '$lib/server/application/ports/UserRepositoryPort';
import { apiOk, type ApiResult } from '$lib/server/http/api';

interface GetAuthStatusResult {
	success: true;
	hasAccount: boolean;
	needsBootstrap: boolean;
	registrationOpen: boolean;
}

export class GetAuthStatusUseCase {
	constructor(private readonly userRepository: UserRepositoryPort) {}

	async execute(): Promise<ApiResult<GetAuthStatusResult>> {
		const userCount = await this.userRepository.count();
		const hasAccount = userCount > 0;

		return apiOk({
			success: true,
			hasAccount,
			needsBootstrap: !hasAccount,
			registrationOpen: !hasAccount
		});
	}
}
