import type { PluginReleaseRepositoryPort } from '$lib/server/application/ports/PluginReleaseRepositoryPort';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import { createChildLogger, toLogError } from '$lib/server/infrastructure/logging/logger';

interface GetKoreaderPluginDownloadResult {
	fileName: string;
	storageKey: string;
	contentType: string;
	sha256: string;
	data: Buffer;
}

export class GetKoreaderPluginDownloadUseCase {
	private readonly useCaseLogger = createChildLogger({ useCase: 'GetKoreaderPluginDownloadUseCase' });

	constructor(
		private readonly storage: StoragePort,
		private readonly pluginReleaseRepository: PluginReleaseRepositoryPort
	) {}

	async execute(version?: string): Promise<ApiResult<GetKoreaderPluginDownloadResult>> {
		const release = version
			? await this.pluginReleaseRepository.getByVersion(version)
			: await this.pluginReleaseRepository.getLatest();

		if (!release) {
			return apiError(version ? 'Plugin version not found' : 'Plugin metadata not found', 404);
		}

		try {
			const data = await this.storage.get(release.storageKey);
			return apiOk({
				fileName: release.fileName,
				storageKey: release.storageKey,
				contentType: 'application/zip',
				sha256: release.sha256,
				data
			});
		} catch (cause) {
			this.useCaseLogger.error(
				{ event: 'plugin.download.failed', storageKey: release.storageKey, version: release.version, error: toLogError(cause) },
				'Failed to read KOReader plugin artifact from storage'
			);
			return apiError('Plugin artifact not found', 404, cause);
		}
	}
}
