import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { LibraryShelf } from '$lib/types/Library/Shelf';

export interface UpdateLibraryShelfResponse {
	success: boolean;
	shelf: LibraryShelf;
}

export async function updateLibraryShelf(
	shelfId: number,
	request: { name: string; icon?: string }
): Promise<Result<UpdateLibraryShelfResponse, ApiError>> {
	try {
		const response = await fetch(`/api/library/shelves/${shelfId}`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(request)
		});

		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		const data: UpdateLibraryShelfResponse = await response.json();
		return ok(data);
	} catch (cause) {
		return err(ApiErrors.network('Network request failed', cause));
	}
}
