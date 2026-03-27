import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import { post } from '../base/post';
import { ZUIRoutes } from '../base/routes';

export interface LookupSearchBookMetadataRequest {
	title: string;
	author?: string | null;
	identifier?: string | null;
	language?: string | null;
}

export interface LookupSearchBookMetadataResponse {
	success: true;
	metadata: {
		googleBooksId: string | null;
		openLibraryKey: string | null;
		amazonAsin: string | null;
		cover: string | null;
		description: string | null;
		publisher: string | null;
		series: string | null;
		volume: string | null;
		seriesIndex: number | null;
		edition: string | null;
		identifier: string | null;
		pages: number | null;
		externalRating: number | null;
		externalRatingCount: number | null;
	};
}

export async function lookupSearchBookMetadata(
	request: LookupSearchBookMetadataRequest
): Promise<Result<LookupSearchBookMetadataResponse, ApiError>> {
	const result = await post(ZUIRoutes.searchBookMetadata, JSON.stringify(request));
	if (!result.ok) {
		return err(result.error);
	}

	try {
		const data: LookupSearchBookMetadataResponse = await result.value.json();
		return ok(data);
	} catch {
		return err(ApiErrors.server('Failed to parse search metadata response', 500));
	}
}
