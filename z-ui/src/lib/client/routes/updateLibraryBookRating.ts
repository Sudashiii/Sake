import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';

export interface UpdateLibraryBookRatingResponse {
	success: boolean;
	bookId: number;
	rating: number | null;
}

export async function updateLibraryBookRating(
	bookId: number,
	rating: number | null
): Promise<Result<UpdateLibraryBookRatingResponse, ApiError>> {
	try {
		const response = await fetch(`/api/library/${bookId}/rating`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ rating })
		});

		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		const data: UpdateLibraryBookRatingResponse = await response.json();
		return ok(data);
	} catch (cause) {
		return err(ApiErrors.network('Network request failed', cause));
	}
}
