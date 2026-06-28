import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import { err, ok, type Result } from '$lib/types/Result';
import type {
	HardcoverProgressSyncStatus,
	TriggerHardcoverProgressSyncResponse
} from '$lib/types/Integrations/HardcoverProgress';
import { ZUIRoutes } from '../base/routes';

export function getHardcoverProgressSyncStatus() {
	return requestPath<HardcoverProgressSyncStatus>(ZUIRoutes.hardcoverProgress, 'GET');
}

export function updateHardcoverProgressSyncSetting(enabled: boolean) {
	return requestPath<HardcoverProgressSyncStatus>(ZUIRoutes.hardcoverProgress, 'PUT', { enabled });
}

export function triggerHardcoverProgressSync() {
	return requestPath<TriggerHardcoverProgressSyncResponse>(
		ZUIRoutes.hardcoverProgressSync,
		'POST'
	);
}

async function requestPath<T>(
	path: string,
	method: 'GET' | 'PUT' | 'POST',
	body?: unknown
): Promise<Result<T, ApiError>> {
	try {
		const response = await fetch(`/api${path}`, {
			method,
			headers: { 'Content-Type': 'application/json' },
			...(body === undefined ? {} : { body: JSON.stringify(body) })
		});
		if (!response.ok) return err(await ApiErrors.fromResponse(response));
		return ok((await response.json()) as T);
	} catch (cause: unknown) {
		return err(ApiErrors.network('Network request failed', cause));
	}
}
