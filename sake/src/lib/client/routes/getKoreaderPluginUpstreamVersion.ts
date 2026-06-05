import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { KoreaderPluginUpstreamVersionResponse } from '$lib/types/Plugin/KoreaderPlugin';
import { type Result, err, ok } from '$lib/types/Result';
import { get } from '../base/get';
import { ZUIRoutes } from '../base/routes';

export async function getKoreaderPluginUpstreamVersion(): Promise<
	Result<KoreaderPluginUpstreamVersionResponse, ApiError>
> {
	const result = await get(ZUIRoutes.koreaderPluginUpstreamVersion);
	if (!result.ok) {
		return err(result.error);
	}

	try {
		return ok((await result.value.json()) as KoreaderPluginUpstreamVersionResponse);
	} catch {
		return err(ApiErrors.server('Failed to parse KOReader plugin upstream version response', 500));
	}
}
