import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { LibraryShelf } from '$lib/types/Library/Shelf';
import { post } from '../base/post';

export interface CreateLibraryShelfResponse {
	success: boolean;
	shelf: LibraryShelf;
}

export async function createLibraryShelf(request: {
	name: string;
	icon?: string;
}): Promise<Result<CreateLibraryShelfResponse, ApiError>> {
	const result = await post('/library/shelves', JSON.stringify(request));
	if (!result.ok) {
		return err(result.error);
	}

	try {
		const data: CreateLibraryShelfResponse = await result.value.json();
		return ok(data);
	} catch {
		return err(ApiErrors.server('Failed to parse create shelf response', 500));
	}
}
