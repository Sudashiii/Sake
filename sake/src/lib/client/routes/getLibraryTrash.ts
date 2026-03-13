import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { LibraryBook } from '$lib/types/Library/Book';
import { get } from '../base/get';

export interface LibraryTrashResponse {
	success: boolean;
	books: LibraryBook[];
}

export async function getLibraryTrash(): Promise<Result<LibraryTrashResponse, ApiError>> {
	const result = await get('/library/trash');

	if (!result.ok) {
		return err(result.error);
	}

	try {
		const data: LibraryTrashResponse = await result.value.json();
		return ok(data);
	} catch {
		return err(ApiErrors.server('Failed to parse trash response', 500));
	}
}
