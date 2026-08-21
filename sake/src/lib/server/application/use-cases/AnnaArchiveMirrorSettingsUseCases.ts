import { isDemoMode } from '$lib/server/config/demoMode';
import { normalizeAnnaArchiveMirrorUrls } from '$lib/server/config/annaArchive';
import type { AnnaArchiveMirrorSettingsPort } from '$lib/server/application/ports/AnnaArchiveMirrorSettingsPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

export interface AnnaArchiveMirrorSettings {
	urls: string[];
}

export class GetAnnaArchiveMirrorSettingsUseCase {
	constructor(private readonly settings: AnnaArchiveMirrorSettingsPort) {}

	async execute(): Promise<ApiResult<AnnaArchiveMirrorSettings>> {
		try {
			return apiOk({ urls: [...(await this.settings.get())] });
		} catch (cause) {
			return apiError('Failed to load Anna Archive mirror settings', 500, cause);
		}
	}
}

export class UpdateAnnaArchiveMirrorSettingsUseCase {
	constructor(private readonly settings: AnnaArchiveMirrorSettingsPort) {}

	async execute(input: unknown): Promise<ApiResult<AnnaArchiveMirrorSettings>> {
		if (isDemoMode()) return apiError('Mirror settings cannot be changed in demo mode', 403);
		if (!isMirrorSettingsInput(input)) return apiError('urls must be an array', 400);
		if (input.urls.length === 0) return apiError('At least one mirror URL is required', 400);

		let urls: string[];
		try {
			urls = normalizeAnnaArchiveMirrorUrls(input.urls);
		} catch (cause) {
			return apiError(cause instanceof Error ? cause.message : 'Invalid mirror configuration', 400, cause);
		}

		try {
			return apiOk({ urls: [...(await this.settings.replace(urls))] });
		} catch (cause) {
			return apiError('Failed to save Anna Archive mirror settings', 500, cause);
		}
	}
}

function isMirrorSettingsInput(input: unknown): input is { urls: string[] } {
	return (
		typeof input === 'object' &&
		input !== null &&
		Array.isArray((input as { urls?: unknown }).urls) &&
		(input as { urls: unknown[] }).urls.every((url) => typeof url === 'string')
	);
}
