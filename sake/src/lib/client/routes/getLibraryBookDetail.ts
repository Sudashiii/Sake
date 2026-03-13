import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { LibraryBookDetail } from '$lib/types/Library/BookDetail';
import { get } from '../base/get';

export async function getLibraryBookDetail(bookId: number): Promise<Result<LibraryBookDetail, ApiError>> {
	const result = await get(`/library/${bookId}/detail`);
	if (!result.ok) {
		return err(result.error);
	}

	try {
		const data: LibraryBookDetail = await result.value.json();
		return ok(data);
	} catch {
		return err(ApiErrors.server('Failed to parse library detail response', 500));
	}
}
