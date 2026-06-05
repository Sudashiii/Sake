import type { PluginReleaseRepositoryPort } from '$lib/server/application/ports/PluginReleaseRepositoryPort';
import {
	getKoreaderPluginUpstreamStatus,
	parseKoreaderPluginMetaVersion,
	type KoreaderPluginUpstreamStatus
} from '$lib/server/application/services/koreaderPluginVersion';
import { apiOk, type ApiResult } from '$lib/server/http/api';
import { createChildLogger, toLogError } from '$lib/server/infrastructure/logging/logger';

export interface KoreaderPluginUpstreamVersionResult {
	uploadedVersion: string | null;
	upstreamVersion: string | null;
	status: KoreaderPluginUpstreamStatus;
	sourceUrl: string;
	checkedAt: string;
}

type FetchMeta = (url: string, init: RequestInit) => Promise<Response>;

const DEFAULT_UPSTREAM_META_URL =
	'https://raw.githubusercontent.com/Sudashiii/Sake/master/koreaderPlugins/sake.koplugin/_meta.lua';
const DEFAULT_TIMEOUT_MS = 5000;

export class GetKoreaderPluginUpstreamVersionUseCase {
	private readonly useCaseLogger = createChildLogger({
		useCase: 'GetKoreaderPluginUpstreamVersionUseCase'
	});

	constructor(
		private readonly pluginReleaseRepository: PluginReleaseRepositoryPort,
		private readonly fetchMeta: FetchMeta = fetch,
		private readonly sourceUrl: string = DEFAULT_UPSTREAM_META_URL,
		private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS
	) {}

	async execute(): Promise<ApiResult<KoreaderPluginUpstreamVersionResult>> {
		const checkedAt = new Date().toISOString();
		const latest = await this.pluginReleaseRepository.getLatest();
		const uploadedVersion = latest?.version ?? null;

		try {
			const upstreamVersion = await this.fetchUpstreamVersion();
			if (!uploadedVersion || !upstreamVersion) {
				return apiOk({
					uploadedVersion,
					upstreamVersion,
					status: 'unavailable',
					sourceUrl: this.sourceUrl,
					checkedAt
				});
			}

			return apiOk({
				uploadedVersion,
				upstreamVersion,
				status: getKoreaderPluginUpstreamStatus(uploadedVersion, upstreamVersion),
				sourceUrl: this.sourceUrl,
				checkedAt
			});
		} catch (cause) {
			this.useCaseLogger.warn(
				{ event: 'plugin.upstream_version.unavailable', error: toLogError(cause) },
				'Could not check upstream KOReader plugin version'
			);
			return apiOk({
				uploadedVersion,
				upstreamVersion: null,
				status: 'unavailable',
				sourceUrl: this.sourceUrl,
				checkedAt
			});
		}
	}

	private async fetchUpstreamVersion(): Promise<string | null> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

		try {
			const response = await this.fetchMeta(this.sourceUrl, {
				method: 'GET',
				signal: controller.signal
			});
			if (!response.ok) {
				throw new Error(`GitHub metadata request failed with ${response.status}`);
			}

			return parseKoreaderPluginMetaVersion(await response.text());
		} finally {
			clearTimeout(timeout);
		}
	}
}
