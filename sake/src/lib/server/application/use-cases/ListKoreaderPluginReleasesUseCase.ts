import type { PluginRelease } from '$lib/server/domain/entities/PluginRelease';
import type { PluginReleaseRepositoryPort } from '$lib/server/application/ports/PluginReleaseRepositoryPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import { createChildLogger } from '$lib/server/infrastructure/logging/logger';

export interface KoreaderPluginReleaseManifest {
	version: string;
	fileName: string;
	storageKey: string;
	sha256: string;
	updatedAt: string;
	isLatest: boolean;
}

interface ListKoreaderPluginReleasesResult {
	latestVersion: string;
	releases: KoreaderPluginReleaseManifest[];
}

function compareVersionStrings(left: string, right: string): number {
	const leftParts = left.match(/\d+/g)?.map((part) => Number.parseInt(part, 10)) ?? [];
	const rightParts = right.match(/\d+/g)?.map((part) => Number.parseInt(part, 10)) ?? [];
	const maxLength = Math.max(leftParts.length, rightParts.length);

	for (let index = 0; index < maxLength; index += 1) {
		const leftValue = leftParts[index] ?? 0;
		const rightValue = rightParts[index] ?? 0;
		if (leftValue !== rightValue) {
			return rightValue - leftValue;
		}
	}

	return right.localeCompare(left);
}

function toManifest(release: PluginRelease): KoreaderPluginReleaseManifest {
	return {
		version: release.version,
		fileName: release.fileName,
		storageKey: release.storageKey,
		sha256: release.sha256,
		updatedAt: release.updatedAt,
		isLatest: release.isLatest
	};
}

export class ListKoreaderPluginReleasesUseCase {
	private readonly useCaseLogger = createChildLogger({ useCase: 'ListKoreaderPluginReleasesUseCase' });

	constructor(private readonly pluginReleaseRepository: PluginReleaseRepositoryPort) {}

	async execute(): Promise<ApiResult<ListKoreaderPluginReleasesResult>> {
		const releases = await this.pluginReleaseRepository.listAll();
		if (releases.length === 0) {
			this.useCaseLogger.error(
				{ event: 'plugin.releases.not_found' },
				'KOReader plugin releases not found in DB'
			);
			return apiError('Plugin releases not found', 404);
		}

		const sorted = [...releases].sort((left, right) => {
			if (left.isLatest !== right.isLatest) {
				return left.isLatest ? -1 : 1;
			}

			const versionCompare = compareVersionStrings(left.version, right.version);
			if (versionCompare !== 0) {
				return versionCompare;
			}

			return right.updatedAt.localeCompare(left.updatedAt);
		});

		return apiOk({
			latestVersion: sorted.find((release) => release.isLatest)?.version ?? sorted[0].version,
			releases: sorted.map(toManifest)
		});
	}
}
