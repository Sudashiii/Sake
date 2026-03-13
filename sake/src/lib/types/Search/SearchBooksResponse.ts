import type { SearchProviderId } from '$lib/types/Search/Provider';
import type { SearchResultBook } from '$lib/types/Search/SearchResultBook';

export interface SearchProviderFailure {
	provider: SearchProviderId;
	error: string;
}

export interface SearchBooksResponse {
	success: true;
	books: SearchResultBook[];
	meta: {
		requestedProviders: SearchProviderId[];
		fulfilledProviders: SearchProviderId[];
		failedProviders: SearchProviderFailure[];
	};
}
