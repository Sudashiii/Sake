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

export interface SearchProviderDownloadInput {
	downloadRef: string;
	title: string;
	extension?: string | null;
}

export interface SearchProviderDownloadResult {
	success: true;
	fileName: string;
	fileData: Uint8Array;
	contentType: string;
}

export interface SearchProviderPort {
	readonly id: SearchProviderId;
	search(
		input: SearchBooksRequest,
		context: SearchProviderContext
	): Promise<ApiResult<SearchResultBook[]>>;
}

export interface SearchProviderDownloadPort extends SearchProviderPort {
	download(
		input: SearchProviderDownloadInput
	): Promise<ApiResult<SearchProviderDownloadResult>>;
}

export function supportsSearchProviderDownload(
	provider: SearchProviderPort
): provider is SearchProviderDownloadPort {
	return typeof (provider as Partial<SearchProviderDownloadPort>).download === 'function';
}
