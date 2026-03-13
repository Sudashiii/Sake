import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { BookProgressHistoryResponse } from '$lib/types/Library/BookProgressHistory';
import { get } from '../base/get';

export async function getLibraryBookProgressHistory(
	bookId: number
): Promise<Result<BookProgressHistoryResponse, ApiError>> {
	const result = await get(`/library/${bookId}/progress-history`);
	if (!result.ok) {
		return err(result.error);
	}

	try {
		const data: BookProgressHistoryResponse = await result.value.json();
		return ok(data);
	} catch {
		return err(ApiErrors.server('Failed to parse progress history response', 500));
	}
}

