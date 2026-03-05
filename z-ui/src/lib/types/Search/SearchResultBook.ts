import type { SearchProviderCapabilities, SearchProviderId } from '$lib/types/Search/Provider';

export interface SearchResultBook {
	provider: SearchProviderId;
	providerBookId: string;
	title: string;
	author: string | null;
	language: string | null;
	year: number | null;
	extension: string | null;
	filesize: number | null;
	cover: string | null;
	description: string | null;
	identifier: string | null;
	isbn: string | null;
	pages: number | null;
	capabilities: SearchProviderCapabilities;
	downloadRef: string | null;
	queueRef: string | null;
	sourceUrl: string | null;
}
