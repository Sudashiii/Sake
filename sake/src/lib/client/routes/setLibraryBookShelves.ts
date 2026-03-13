import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';

export interface SetLibraryBookShelvesResponse {
	success: boolean;
	bookId: number;
	shelfIds: number[];
}

export async function setLibraryBookShelves(
	bookId: number,
	shelfIds: number[]
): Promise<Result<SetLibraryBookShelvesResponse, ApiError>> {
	try {
		const response = await fetch(`/api/library/${bookId}/shelves`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ shelfIds })
		});

		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		const data: SetLibraryBookShelvesResponse = await response.json();
		return ok(data);
	} catch (cause) {
		return err(ApiErrors.network('Network request failed', cause));
	}
}
