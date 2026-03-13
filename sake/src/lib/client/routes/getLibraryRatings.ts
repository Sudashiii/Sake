import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { RatedBook } from '$lib/types/Library/RatedBook';
import { get } from '../base/get';

export interface LibraryRatingsResponse {
	success: boolean;
	books: RatedBook[];
}

export async function getLibraryRatings(): Promise<Result<LibraryRatingsResponse, ApiError>> {
	const result = await get('/library/ratings');

	if (!result.ok) {
		return err(result.error);
	}

	try {
		const data: LibraryRatingsResponse = await result.value.json();
		return ok(data);
	} catch {
		return err(ApiErrors.server('Failed to parse ratings response', 500));
	}
}
