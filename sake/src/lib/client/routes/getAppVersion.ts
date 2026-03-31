import { type Result, err, ok } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { AppVersionResponse } from '$lib/types/App/AppVersion';
import { get } from '../base/get';
import { ZUIRoutes } from '../base/routes';

export async function getAppVersion(): Promise<Result<AppVersionResponse, ApiError>> {
	const result = await get(ZUIRoutes.appVersion);
	if (!result.ok) {
		return err(result.error);
	}

	try {
		return ok((await result.value.json()) as AppVersionResponse);
	} catch {
		return err(ApiErrors.server('Failed to parse app version response', 500));
	}
}
