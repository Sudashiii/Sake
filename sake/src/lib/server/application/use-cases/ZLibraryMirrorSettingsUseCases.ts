import { isDemoMode } from '$lib/server/config/demoMode';
import { normalizeZLibraryUrl } from '$lib/server/config/zlibrary';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import { ZLibraryMirrorSettingsRepository } from '$lib/server/infrastructure/repositories/ZLibraryMirrorSettingsRepository';

export interface ZLibraryMirrorSettings {
	urls: string[];
}

export class GetZLibraryMirrorSettingsUseCase {
	constructor(private readonly settings: ZLibraryMirrorSettingsRepository) {}

	async execute(): Promise<ApiResult<ZLibraryMirrorSettings>> {
		return apiOk({ urls: await this.settings.get() });
	}
}

export class UpdateZLibraryMirrorSettingsUseCase {
	constructor(private readonly settings: ZLibraryMirrorSettingsRepository) {}

	async execute(input: unknown): Promise<ApiResult<ZLibraryMirrorSettings>> {
		if (isDemoMode()) return apiError('Mirror settings cannot be changed in demo mode', 403);
		if (!isMirrorSettingsInput(input)) return apiError('urls must be an array', 400);
		if (input.urls.length === 0) return apiError('At least one mirror URL is required', 400);

		try {
			const urls = input.urls.map(normalizeZLibraryUrl);
			if (new Set(urls).size !== urls.length) return apiError('Mirror URLs must be unique', 400);
			return apiOk({ urls: await this.settings.replace(urls) });
		} catch (cause) {
			return apiError(cause instanceof Error ? cause.message : 'Invalid mirror configuration', 400, cause);
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
