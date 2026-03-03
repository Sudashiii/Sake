import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import { generateAuthHeader } from '../base/authHeader';

export interface DeleteLibraryShelfResponse {
	success: boolean;
	shelfId: number;
}

export async function deleteLibraryShelf(
	shelfId: number
): Promise<Result<DeleteLibraryShelfResponse, ApiError>> {
	const authResult = generateAuthHeader();
	if (!authResult.ok) {
		return err(authResult.error);
	}

	try {
		const response = await fetch(`/api/library/shelves/${shelfId}`, {
			method: 'DELETE',
			headers: {
				Authorization: authResult.value
			}
		});

		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		const data: DeleteLibraryShelfResponse = await response.json();
		return ok(data);
	} catch (cause) {
		return err(ApiErrors.network('Network request failed', cause));
	}
}
