import { ExternalBookMetadataService } from '$lib/server/application/services/ExternalBookMetadataService';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface LookupSearchBookMetadataInput {
	title: string;
	author?: string | null;
	identifier?: string | null;
	language?: string | null;
}

interface LookupSearchBookMetadataResult {
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

function normalizeText(value: string | null | undefined): string | null {
	if (typeof value !== 'string') {
		return null;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export class LookupSearchBookMetadataUseCase {
	constructor(
		private readonly externalMetadataService = new ExternalBookMetadataService()
	) {}

	async execute(
		input: LookupSearchBookMetadataInput
	): Promise<ApiResult<LookupSearchBookMetadataResult>> {
		const title = normalizeText(input.title);
		if (!title) {
			return apiError('title is required', 400);
		}

		try {
			const metadata = await this.externalMetadataService.lookup({
				title,
				author: normalizeText(input.author),
				identifier: normalizeText(input.identifier),
				language: normalizeText(input.language)
			});

			return apiOk({
				success: true,
				metadata
			});
		} catch (cause: unknown) {
			return apiError('Failed to lookup external metadata', 502, cause);
		}
	}
}
