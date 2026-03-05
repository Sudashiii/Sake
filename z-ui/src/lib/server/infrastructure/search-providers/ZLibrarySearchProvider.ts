import type {
	SearchProviderContext,
	SearchProviderPort
} from '$lib/server/application/ports/SearchProviderPort';
import type { ZLibraryPort } from '$lib/server/application/ports/ZLibraryPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import type { SearchBooksRequest } from '$lib/types/Search/SearchBooksRequest';
import type { SearchResultBook } from '$lib/types/Search/SearchResultBook';
import { extractIsbn } from '$lib/utils/isbn';
import type { ZSearchBookRequest } from '$lib/types/ZLibrary/Requests/ZSearchBookRequest';
import type { ZBook } from '$lib/types/ZLibrary/ZBook';

const ZLIBRARY_BOOK_CAPABILITIES = {
	filesAvailable: true,
	metadataCompleteness: 'high'
} as const;

function normalizeBookUrl(href: string): string | null {
	const normalized = href.trim();
	if (!normalized) {
		return null;
	}
	if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
		return normalized;
	}
	return `https://1lib.sk${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
}

function mapSort(sort: SearchBooksRequest['sort']): string | undefined {
	if (sort === 'year_desc') {
		return 'desc';
	}
	if (sort === 'year_asc') {
		return 'asc';
	}
	return undefined;
}

function toZLibraryRequest(input: SearchBooksRequest): ZSearchBookRequest {
	return {
		searchText: input.query,
		yearFrom: input.filters?.yearFrom !== undefined ? String(input.filters.yearFrom) : undefined,
		yearTo: input.filters?.yearTo !== undefined ? String(input.filters.yearTo) : undefined,
		languages: input.filters?.language,
		extensions: input.filters?.extension,
		order: mapSort(input.sort),
		limit: input.filters?.limitPerProvider
	};
}

function mapBook(book: ZBook): SearchResultBook {
	return {
		provider: 'zlibrary',
		providerBookId: String(book.id),
		title: book.title,
		author: book.author?.trim() ? book.author : null,
		language: book.language?.trim() ? book.language : null,
		year: typeof book.year === 'number' ? book.year : null,
		extension: book.extension?.trim() ? book.extension : null,
		filesize: typeof book.filesize === 'number' ? book.filesize : null,
		cover: book.cover?.trim() ? book.cover : null,
		description: book.description?.trim() ? book.description : null,
		identifier: book.identifier?.trim() ? book.identifier : null,
		isbn: extractIsbn(book.identifier),
		pages: typeof book.pages === 'number' ? book.pages : null,
		capabilities: ZLIBRARY_BOOK_CAPABILITIES,
		downloadRef: book.hash?.trim() ? book.hash : null,
		queueRef: book.hash?.trim() ? book.hash : null,
		sourceUrl: normalizeBookUrl(book.href)
	};
}

export class ZLibrarySearchProvider implements SearchProviderPort {
	readonly id = 'zlibrary' as const;

	constructor(private readonly zlibrary: ZLibraryPort) {}

	async search(
		input: SearchBooksRequest,
		context: SearchProviderContext
	): Promise<ApiResult<SearchResultBook[]>> {
		const credentials = context.zlibraryCredentials;
		if (!credentials) {
			return apiError('Z-Library login is not valid', 409);
		}

		const loginResult = await this.zlibrary.tokenLogin(credentials.userId, credentials.userKey);
		if (!loginResult.ok) {
			return loginResult;
		}

		const searchResult = await this.zlibrary.search(toZLibraryRequest(input));
		if (!searchResult.ok) {
			return searchResult;
		}

		return apiOk(searchResult.value.books.map(mapBook));
	}
}
