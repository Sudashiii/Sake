import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { ReadingActivityStats } from '$lib/types/Stats/ReadingActivityStats';
import { get } from '../base/get';

export async function getReadingActivityStats(days = 365): Promise<Result<ReadingActivityStats, ApiError>> {
	const result = await get(`/stats/reading-activity?days=${days}`);

	if (!result.ok) {
		return err(result.error);
	}

	try {
		const data: ReadingActivityStats = await result.value.json();
		return ok(data);
	} catch {
		return err(ApiErrors.server('Failed to parse reading activity stats response', 500));
	}
}
