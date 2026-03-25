import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import { post } from '../base/post';

export interface RefetchLibraryBookMetadataResponse {
	success: boolean;
	book: {
		id: number;
		zLibId: string | null;
		title: string;
		author: string | null;
		publisher: string | null;
		series: string | null;
		volume: string | null;
		edition: string | null;
		identifier: string | null;
		pages: number | null;
		description: string | null;
		googleBooksId: string | null;
		openLibraryKey: string | null;
		amazonAsin: string | null;
		externalRating: number | null;
		externalRatingCount: number | null;
		cover: string | null;
		extension: string | null;
		filesize: number | null;
		language: string | null;
		year: number | null;
	};
}

export async function refetchLibraryBookMetadata(
	bookId: number
): Promise<Result<RefetchLibraryBookMetadataResponse, ApiError>> {
	const result = await post(`/library/${bookId}/refetch-metadata`, '{}');
	if (!result.ok) {
		return err(result.error);
	}

	try {
		const data: RefetchLibraryBookMetadataResponse = await result.value.json();
		return ok(data);
	} catch {
		return err(ApiErrors.server('Failed to parse refetch metadata response', 500));
	}
}
