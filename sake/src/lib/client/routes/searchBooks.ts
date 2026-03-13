import { type Result, err, ok } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { SearchBooksRequest } from '$lib/types/Search/SearchBooksRequest';
import type { SearchBooksResponse } from '$lib/types/Search/SearchBooksResponse';
import { post } from '../base/post';
import { ZUIRoutes } from '../base/routes';

export async function searchBooks(
	request: SearchBooksRequest
): Promise<Result<SearchBooksResponse, ApiError>> {
	const result = await post(ZUIRoutes.searchBooks, JSON.stringify(request));
	if (!result.ok) {
		return err(result.error);
	}

	try {
		const data: SearchBooksResponse = await result.value.json();
		return ok(data);
	} catch {
		return err(ApiErrors.server('Failed to parse search response', 500));
	}
}
