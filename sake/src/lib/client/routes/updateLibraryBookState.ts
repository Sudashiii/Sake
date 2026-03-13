import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';

export interface UpdateLibraryBookStateResponse {
	success: boolean;
	bookId: number;
	isRead: boolean;
	readAt: string | null;
	progressPercent: number | null;
	excludeFromNewBooks: boolean;
	isArchived: boolean;
	archivedAt: string | null;
}

interface UpdateLibraryBookStateRequest {
	isRead?: boolean;
	excludeFromNewBooks?: boolean;
	archived?: boolean;
}

export async function updateLibraryBookState(
	bookId: number,
	request: UpdateLibraryBookStateRequest
): Promise<Result<UpdateLibraryBookStateResponse, ApiError>> {
	try {
		const response = await fetch(`/api/library/${bookId}/state`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(request)
		});

		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		const data: UpdateLibraryBookStateResponse = await response.json();
		return ok(data);
	} catch (cause) {
		return err(ApiErrors.network('Network request failed', cause));
	}
}
