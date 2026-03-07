import type { UserApiKeyRepositoryPort } from '$lib/server/application/ports/UserApiKeyRepositoryPort';
import type { UserRepositoryPort } from '$lib/server/application/ports/UserRepositoryPort';
import type { UserSessionRepositoryPort } from '$lib/server/application/ports/UserSessionRepositoryPort';
import { hashOpaqueToken } from '$lib/server/application/services/LocalAuthService';
import type { AuthActor } from '$lib/server/domain/entities/AuthActor';

interface ResolveRequestAuthInput {
	sessionToken?: string | null;
	apiKey?: string | null;
}

export class ResolveRequestAuthUseCase {
	constructor(
		private readonly userRepository: UserRepositoryPort,
		private readonly sessionRepository: UserSessionRepositoryPort,
		private readonly apiKeyRepository: UserApiKeyRepositoryPort
	) {}

	async execute(input: ResolveRequestAuthInput): Promise<AuthActor | null> {
		const nowIso = new Date().toISOString();

		if (input.sessionToken) {
			const session = await this.sessionRepository.getActiveByTokenHash(
				hashOpaqueToken(input.sessionToken),
				nowIso
			);
			if (session) {
				const user = await this.userRepository.getById(session.userId);
				if (user && !user.isDisabled) {
					await this.sessionRepository.touchLastUsed(session.id, nowIso);
					return {
						type: 'session',
						user,
						sessionId: session.id
					};
				}
			}
		}

		if (input.apiKey) {
			const apiKey = await this.apiKeyRepository.getActiveByKeyHash(
				hashOpaqueToken(input.apiKey),
				nowIso
			);
			if (apiKey) {
				const user = await this.userRepository.getById(apiKey.userId);
				if (user && !user.isDisabled) {
					await this.apiKeyRepository.touchLastUsed(apiKey.id, nowIso);
					return {
						type: 'api_key',
						user,
						apiKeyId: apiKey.id,
						deviceId: apiKey.deviceId,
						scope: apiKey.scope
					};
				}
			}
		}

		return null;
	}
}
