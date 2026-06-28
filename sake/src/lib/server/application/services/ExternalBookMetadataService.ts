import { MetadataAggregatorService } from '$lib/server/application/services/MetadataAggregatorService';
import { sanitizeMetadataDescription } from '$lib/server/application/services/MetadataDescriptionSanitizer';
import type { MetadataCandidate } from '$lib/server/application/ports/MetadataProviderPort';

export interface ExternalBookMetadata {
	googleBooksId: string | null;
	openLibraryKey: string | null;
	hardcoverId?: string | null;
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
	year: number | null;
	month: number | null;
	day: number | null;
}

export interface ExternalBookMetadataLookupInput {
	title: string;
	author: string | null;
	identifier: string | null;
	language?: string | null;
}

function pickFirst<T>(...values: Array<T | null | undefined>): T | null {
	for (const value of values) {
		if (value !== null && value !== undefined) {
			return value;
		}
	}
	return null;
}

function extractAmazonAsin(identifier: string | null): string | null {
	if (!identifier) {
		return null;
	}
	const trimmed = identifier.trim();
	if (/^[A-Z0-9]{10}$/i.test(trimmed)) {
		return trimmed.toUpperCase();
	}
	return null;
}

function candidateDescription(candidate: MetadataCandidate): string | null {
	return sanitizeMetadataDescription(candidate.description, candidate.descriptionFormat);
}

export class ExternalBookMetadataService {
	private readonly aggregator: MetadataAggregatorService;

	constructor(aggregator?: MetadataAggregatorService) {
		this.aggregator = aggregator ?? new MetadataAggregatorService([]);
	}

	async lookup(input: ExternalBookMetadataLookupInput): Promise<ExternalBookMetadata> {
		const { candidates } = await this.aggregator.lookup({
			title: input.title,
			author: input.author,
			isbn: input.identifier,
			language: input.language
		});

		const googleCandidate = candidates.find((c) => c.providerId === 'googlebooks');
		const olCandidate = candidates.find((c) => c.providerId === 'openlibrary');
		const hardcoverCandidate = candidates.find((c) => c.providerId === 'hardcover');

		const bestIsbn13 = pickFirst(...candidates.map((c) => c.identifiers.isbn13));
		const bestIsbn10 = pickFirst(...candidates.map((c) => c.identifiers.isbn10));
		const bestIsbn = pickFirst(bestIsbn13, bestIsbn10, input.identifier);

		const bestCoverUrl = pickFirst(...candidates.map((c) => c.covers[0]?.url ?? null));

		return {
			googleBooksId: googleCandidate?.identifiers.googleBooksId ?? null,
			openLibraryKey: olCandidate?.identifiers.openLibraryKey ?? null,
			hardcoverId: hardcoverCandidate?.identifiers.hardcoverId ?? null,
			amazonAsin: extractAmazonAsin(input.identifier),
			cover: bestCoverUrl,
			description: pickFirst(...candidates.map(candidateDescription)),
			publisher: pickFirst(...candidates.map((c) => c.publisher)),
			series: pickFirst(...candidates.map((c) => c.series)),
			volume: null,
			seriesIndex: pickFirst(...candidates.map((c) => c.seriesIndex)),
			edition: pickFirst(...candidates.map((c) => c.subtitle)),
			identifier: bestIsbn,
			pages: pickFirst(...candidates.map((c) => c.pageCount)),
			externalRating: pickFirst(...candidates.map((c) => c.rating.average)),
			externalRatingCount: pickFirst(...candidates.map((c) => c.rating.count)),
			year: pickFirst(...candidates.map((c) => c.publishedDate.year)),
			month: pickFirst(...candidates.map((c) => c.publishedDate.month)),
			day: pickFirst(...candidates.map((c) => c.publishedDate.day))
		};
	}
}
