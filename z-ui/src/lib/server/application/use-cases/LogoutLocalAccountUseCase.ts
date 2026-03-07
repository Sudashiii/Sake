import type { UserSessionRepositoryPort } from '$lib/server/application/ports/UserSessionRepositoryPort';
import { hashOpaqueToken } from '$lib/server/application/services/LocalAuthService';
import { apiOk, type ApiResult } from '$lib/server/http/api';

interface LogoutLocalAccountInput {
	sessionToken?: string | null;
}

interface LogoutLocalAccountResult {
	success: true;
}

export class LogoutLocalAccountUseCase {
	constructor(private readonly sessionRepository: UserSessionRepositoryPort) {}

	async execute(input: LogoutLocalAccountInput): Promise<ApiResult<LogoutLocalAccountResult>> {
		if (input.sessionToken) {
			await this.sessionRepository.revokeByTokenHash(
				hashOpaqueToken(input.sessionToken),
				new Date().toISOString()
			);
		}

		return apiOk({ success: true });
	}
}
