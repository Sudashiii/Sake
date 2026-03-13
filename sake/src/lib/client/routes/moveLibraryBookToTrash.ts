import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import { post } from '../base/post';

interface MoveLibraryBookToTrashResponse {
	success: boolean;
	bookId: number;
	trashExpiresAt: string;
}

export async function moveLibraryBookToTrash(
	bookId: number
): Promise<Result<MoveLibraryBookToTrashResponse, ApiError>> {
	const result = await post(`/library/${bookId}/trash`, '{}');
	if (!result.ok) {
		return err(result.error);
	}

	try {
		const data: MoveLibraryBookToTrashResponse = await result.value.json();
		return ok(data);
	} catch {
		return err(ApiErrors.server('Failed to parse move-to-trash response', 500));
	}
}
