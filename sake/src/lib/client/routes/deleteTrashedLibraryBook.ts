import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';

interface DeleteTrashedLibraryBookResponse {
	success: boolean;
	bookId: number;
}

export async function deleteTrashedLibraryBook(
	bookId: number
): Promise<Result<DeleteTrashedLibraryBookResponse, ApiError>> {
	try {
		const response = await fetch(`/api/library/${bookId}/trash`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		const data: DeleteTrashedLibraryBookResponse = await response.json();
		return ok(data);
	} catch (cause) {
		return err(ApiErrors.network('Network request failed', cause));
	}
}
