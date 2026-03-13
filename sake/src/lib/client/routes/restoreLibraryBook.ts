import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import { post } from '../base/post';

interface RestoreLibraryBookResponse {
	success: boolean;
	bookId: number;
}

export async function restoreLibraryBook(
	bookId: number
): Promise<Result<RestoreLibraryBookResponse, ApiError>> {
	const result = await post(`/library/${bookId}/restore`, '{}');
	if (!result.ok) {
		return err(result.error);
	}

	try {
		const data: RestoreLibraryBookResponse = await result.value.json();
		return ok(data);
	} catch {
		return err(ApiErrors.server('Failed to parse restore response', 500));
	}
}
