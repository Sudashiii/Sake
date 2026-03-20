import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';

export interface ImportLibraryBookCoverResponse {
	success: boolean;
	bookId: number;
	cover: string;
}

export async function importLibraryBookCover(
	bookId: number,
	coverUrl?: string | null
): Promise<Result<ImportLibraryBookCoverResponse, ApiError>> {
	try {
		const response = await fetch(`/api/library/${bookId}/cover/import`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ coverUrl: coverUrl ?? null })
		});
		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		return ok((await response.json()) as ImportLibraryBookCoverResponse);
	} catch (cause) {
		return err(ApiErrors.network('Network request failed', cause));
	}
}
