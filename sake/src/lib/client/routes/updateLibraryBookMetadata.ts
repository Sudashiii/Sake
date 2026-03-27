import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';

export interface UpdateLibraryBookMetadataRequest {
	title?: string;
	author?: string | null;
	publisher?: string | null;
	series?: string | null;
	volume?: string | null;
	seriesIndex?: number | null;
	edition?: string | null;
	identifier?: string | null;
	pages?: number | null;
	description?: string | null;
	cover?: string | null;
	language?: string | null;
	year?: number | null;
	externalRating?: number | null;
	externalRatingCount?: number | null;
	googleBooksId?: string | null;
	openLibraryKey?: string | null;
	amazonAsin?: string | null;
}

interface UpdateLibraryBookMetadataResponse {
	success: boolean;
	bookId: number;
}

export async function updateLibraryBookMetadata(
	bookId: number,
	request: UpdateLibraryBookMetadataRequest
): Promise<Result<UpdateLibraryBookMetadataResponse, ApiError>> {
	try {
		const response = await fetch(`/api/library/${bookId}/metadata`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(request)
		});
		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		return ok((await response.json()) as UpdateLibraryBookMetadataResponse);
	} catch (cause) {
		return err(ApiErrors.network('Network request failed', cause));
	}
}
