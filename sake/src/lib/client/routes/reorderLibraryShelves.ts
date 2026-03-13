import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { LibraryShelf } from '$lib/types/Library/Shelf';

export interface ReorderLibraryShelvesResponse {
	success: boolean;
	shelves: LibraryShelf[];
}

export async function reorderLibraryShelves(
	shelfIds: number[]
): Promise<Result<ReorderLibraryShelvesResponse, ApiError>> {
	try {
		const response = await fetch('/api/library/shelves/reorder', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ shelfIds })
		});

		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		const data: ReorderLibraryShelvesResponse = await response.json();
		return ok(data);
	} catch (cause) {
		return err(ApiErrors.network('Network request failed', cause));
	}
}
