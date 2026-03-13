import type { UserSessionRepositoryPort } from '$lib/server/application/ports/UserSessionRepositoryPort';
import { apiOk, type ApiResult } from '$lib/server/http/api';

interface LogoutAllLocalSessionsInput {
	userId: number;
}

interface LogoutAllLocalSessionsResult {
	success: true;
}

export class LogoutAllLocalSessionsUseCase {
	constructor(private readonly sessionRepository: UserSessionRepositoryPort) {}

	async execute(input: LogoutAllLocalSessionsInput): Promise<ApiResult<LogoutAllLocalSessionsResult>> {
		await this.sessionRepository.revokeAllActiveByUserId(input.userId, new Date().toISOString());

		return apiOk({
			success: true
		});
	}
}
