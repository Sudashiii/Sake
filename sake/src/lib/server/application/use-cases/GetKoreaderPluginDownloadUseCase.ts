import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import type { GetLatestKoreaderPluginUseCase } from '$lib/server/application/use-cases/GetLatestKoreaderPluginUseCase';
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
		private readonly getLatestKoreaderPluginUseCase: GetLatestKoreaderPluginUseCase
	) {}

	async execute(): Promise<ApiResult<GetKoreaderPluginDownloadResult>> {
		const latest = await this.getLatestKoreaderPluginUseCase.execute();
		if (!latest.ok) {
			return apiError(latest.error.message, latest.error.status, latest.error.cause);
		}

		try {
			const data = await this.storage.get(latest.value.storageKey);
			return apiOk({
				fileName: latest.value.fileName,
				storageKey: latest.value.storageKey,
				contentType: 'application/zip',
				sha256: latest.value.sha256,
				data
			});
		} catch (cause) {
			this.useCaseLogger.error(
				{ event: 'plugin.download.failed', storageKey: latest.value.storageKey, error: toLogError(cause) },
				'Failed to read KOReader plugin artifact from storage'
			);
			return apiError('Plugin artifact not found', 404, cause);
		}
	}
}
