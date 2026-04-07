import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { ImportLibraryBookCoverResponse } from './importLibraryBookCover';

export async function uploadLibraryBookCover(
	bookId: number,
	file: File
): Promise<Result<ImportLibraryBookCoverResponse, ApiError>> {
	try {
		const formData = new FormData();
		formData.set('file', file);

		const response = await fetch(`/api/library/${bookId}/cover/upload`, {
			method: 'POST',
			body: formData
		});
		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		return ok((await response.json()) as ImportLibraryBookCoverResponse);
	} catch (cause) {
		return err(ApiErrors.network('Network request failed', cause));
	}
}
