import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import type { PluginReleaseRepositoryPort } from '$lib/server/application/ports/PluginReleaseRepositoryPort';
import type { KoreaderPluginArtifactService } from '$lib/server/application/services/KoreaderPluginArtifactService';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import { createChildLogger, toLogError } from '$lib/server/infrastructure/logging/logger';

interface SyncKoreaderPluginReleaseResult {
	version: string;
	storageKey: string;
	uploaded: boolean;
}

export class SyncKoreaderPluginReleaseUseCase {
	private readonly useCaseLogger = createChildLogger({ useCase: 'SyncKoreaderPluginReleaseUseCase' });

	constructor(
		private readonly storage: StoragePort,
		private readonly pluginReleaseRepository: PluginReleaseRepositoryPort,
		private readonly artifactService: KoreaderPluginArtifactService
	) {}

	async execute(): Promise<ApiResult<SyncKoreaderPluginReleaseResult>> {
		try {
			const artifact = await this.artifactService.buildArtifact();
			this.useCaseLogger.info(
				{
					event: 'plugin.sync.version_detected',
					version: artifact.version,
					pluginDir: artifact.pluginDir,
					metaPath: artifact.metaPath,
					storageKey: artifact.storageKey
				},
				'Detected KOReader plugin version for sync'
			);
			const uploaded = !(await this.objectExists(artifact.storageKey));

			if (uploaded) {
				await this.storage.put(artifact.storageKey, artifact.bytes, artifact.contentType);
				this.useCaseLogger.info(
					{
						event: 'plugin.sync.uploaded',
						version: artifact.version,
						storageKey: artifact.storageKey,
						sizeBytes: artifact.bytes.byteLength
					},
					'Uploaded KOReader plugin release artifact'
				);
			} else {
				this.useCaseLogger.info(
					{
						event: 'plugin.sync.skipped_existing',
						version: artifact.version,
						storageKey: artifact.storageKey,
						reason: 'same_version_already_uploaded'
					},
					'Skipped plugin upload because this version already exists in object storage'
				);
			}

			await this.pluginReleaseRepository.upsert({
				version: artifact.version,
				fileName: artifact.fileName,
				storageKey: artifact.storageKey,
				sha256: artifact.sha256
			});
			await this.pluginReleaseRepository.setLatestVersion(artifact.version);
			this.useCaseLogger.info(
				{ event: 'plugin.sync.latest_updated', version: artifact.version, storageKey: artifact.storageKey },
				'Updated KOReader plugin latest release in DB'
			);

			return apiOk({
				version: artifact.version,
				storageKey: artifact.storageKey,
				uploaded
			});
		} catch (cause) {
			this.useCaseLogger.error(
				{ event: 'plugin.sync.failed', error: toLogError(cause) },
				'KOReader plugin startup sync failed'
			);
			return apiError('Failed to sync KOReader plugin release', 500, cause);
		}
	}

	private async objectExists(key: string): Promise<boolean> {
		const objects = await this.storage.list(key);
		return objects.some((object) => object.key === key);
	}
}
