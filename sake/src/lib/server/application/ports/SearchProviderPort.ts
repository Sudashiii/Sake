import type { ApiResult } from '$lib/server/http/api';
import type { SearchProviderId } from '$lib/types/Search/Provider';
import type { SearchBooksRequest } from '$lib/types/Search/SearchBooksRequest';
import type { SearchResultBook } from '$lib/types/Search/SearchResultBook';

export interface SearchProviderContext {
	zlibraryCredentials?: {
		userId: string;
		userKey: string;
	} | null;
}

export interface SearchProviderPort {
	readonly id: SearchProviderId;
	search(
		input: SearchBooksRequest,
		context: SearchProviderContext
	): Promise<ApiResult<SearchResultBook[]>>;
}
