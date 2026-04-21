import type { ApiResult } from '$lib/server/http/api';
import type { MetadataProviderId } from '$lib/types/Metadata/Provider';

export interface MetadataQuery {
	title?: string | null;
	author?: string | null;
	isbn?: string | null;
	language?: string | null;
	googleBooksId?: string | null;
	openLibraryKey?: string | null;
	hardcoverId?: string | null;
	limit?: number;
}

export interface MetadataCoverCandidate {
	url: string;
	width?: number;
	height?: number;
	source: string;
}

export interface MetadataCandidate {
	providerId: MetadataProviderId;
	providerScore: number;
	identifiers: {
		isbn10: string | null;
		isbn13: string | null;
		asin: string | null;
		googleBooksId: string | null;
		openLibraryKey: string | null;
		hardcoverId: string | null;
	};
	title: string;
	subtitle: string | null;
	authors: string[];
	description: string | null;
	descriptionFormat: 'text' | 'html' | 'markdown';
	subjects: string[];
	series: string | null;
	seriesIndex: number | null;
	publisher: string | null;
	publishedDate: { year: number | null; month: number | null; day: number | null };
	language: string | null;
	pageCount: number | null;
	covers: MetadataCoverCandidate[];
	rating: { average: number | null; count: number | null };
	sourceUrl: string | null;
}

export interface MetadataProviderCapabilities {
	touchedFields: ReadonlySet<string>;
	hasCover: boolean;
	hasRating: boolean;
	requiresIsbn: boolean;
}

export interface MetadataProviderPort {
	readonly id: MetadataProviderId;
	readonly capabilities: MetadataProviderCapabilities;
	lookup(query: MetadataQuery): Promise<ApiResult<MetadataCandidate[]>>;
}
