import type { PluginReleaseRepositoryPort } from '$lib/server/application/ports/PluginReleaseRepositoryPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import { createChildLogger } from '$lib/server/infrastructure/logging/logger';

export interface KoreaderPluginLatestManifest {
	version: string;
	fileName: string;
	storageKey: string;
	sha256: string;
	updatedAt: string;
}

export class GetLatestKoreaderPluginUseCase {
	private readonly useCaseLogger = createChildLogger({ useCase: 'GetLatestKoreaderPluginUseCase' });

	constructor(private readonly pluginReleaseRepository: PluginReleaseRepositoryPort) {}

	async execute(): Promise<ApiResult<KoreaderPluginLatestManifest>> {
		const latest = await this.pluginReleaseRepository.getLatest();
		if (!latest) {
			this.useCaseLogger.error(
				{ event: 'plugin.latest.not_found' },
				'KOReader plugin latest release not found in DB'
			);
			return apiError('Plugin metadata not found', 404);
		}

		return apiOk({
			version: latest.version,
			fileName: latest.fileName,
			storageKey: latest.storageKey,
			sha256: latest.sha256,
			updatedAt: latest.updatedAt
		});
	}
}
