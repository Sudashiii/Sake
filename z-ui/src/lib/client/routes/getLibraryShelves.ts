import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { LibraryShelf } from '$lib/types/Library/Shelf';
import { get } from '../base/get';

export interface GetLibraryShelvesResponse {
	success: boolean;
	shelves: LibraryShelf[];
}

export async function getLibraryShelves(): Promise<Result<GetLibraryShelvesResponse, ApiError>> {
	const result = await get('/library/shelves');
	if (!result.ok) {
		return err(result.error);
	}

	try {
		const data: GetLibraryShelvesResponse = await result.value.json();
		return ok(data);
	} catch {
		return err(ApiErrors.server('Failed to parse shelves response', 500));
	}
}
