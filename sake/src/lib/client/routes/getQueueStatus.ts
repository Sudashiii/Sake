import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import { get } from '../base/get';
import type { QueueStatusResponse } from '$lib/types/Queue/QueueStatus';

export type { QueueStatusResponse } from '$lib/types/Queue/QueueStatus';

export async function getQueueStatus(): Promise<Result<QueueStatusResponse, ApiError>> {
	const result = await get('/queue');
	if (!result.ok) {
		return err(result.error);
	}

	try {
		return ok((await result.value.json()) as QueueStatusResponse);
	} catch {
		return err(ApiErrors.server('Failed to parse queue status response', 500));
	}
}
