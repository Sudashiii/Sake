import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { KoreaderPluginReleasesResponse } from '$lib/types/Plugin/KoreaderPlugin';
import { type Result, err, ok } from '$lib/types/Result';
import { get } from '../base/get';
import { ZUIRoutes } from '../base/routes';

export async function getKoreaderPluginReleases(): Promise<
	Result<KoreaderPluginReleasesResponse, ApiError>
> {
	const result = await get(ZUIRoutes.koreaderPluginReleases);
	if (!result.ok) {
		return err(result.error);
	}

	try {
		return ok((await result.value.json()) as KoreaderPluginReleasesResponse);
	} catch {
		return err(ApiErrors.server('Failed to parse KOReader plugin releases response', 500));
	}
}
