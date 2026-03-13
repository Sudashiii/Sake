import type {
	SearchProviderContext,
	SearchProviderPort
} from '$lib/server/application/ports/SearchProviderPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import type { SearchBooksRequest } from '$lib/types/Search/SearchBooksRequest';
import type { SearchResultBook } from '$lib/types/Search/SearchResultBook';

const OPENLIBRARY_BOOK_CAPABILITIES = {
	filesAvailable: false,
	metadataCompleteness: 'medium'
} as const;

interface OpenLibrarySearchDoc {
	key?: string;
	title?: string;
	author_name?: string[];
	language?: string[];
	first_publish_year?: number;
	cover_i?: number;
	isbn?: string[];
	number_of_pages_median?: number;
	ebook_access?: string;
	public_scan_b?: boolean;
	ia?: string[];
}

interface OpenLibrarySearchPayload {
	docs?: OpenLibrarySearchDoc[];
}

interface ErrorWithCode {
	code?: string;
}

function hasText(value: string | null | undefined): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function normalizeLanguageToken(value: string): string {
	return value.trim().toLowerCase();
}

function languageFilterTokens(input: SearchBooksRequest): Set<string> {
	const languages = input.filters?.language ?? [];
	const tokens = new Set<string>();
	const add = (value: string) => {
		const normalized = normalizeLanguageToken(value);
		if (!normalized) {
			return;
		}
		tokens.add(normalized);
	};

	const mapping: Record<string, string[]> = {
		english: ['en', 'eng'],
		german: ['de', 'deu', 'ger'],
		french: ['fr', 'fra', 'fre'],
		spanish: ['es', 'spa'],
		italian: ['it', 'ita'],
		portuguese: ['pt', 'por']
	};

	for (const language of languages) {
		add(language);
		for (const token of mapping[normalizeLanguageToken(language)] ?? []) {
			add(token);
		}
	}

	return tokens;
}

function matchesLanguageFilter(doc: OpenLibrarySearchDoc, languageTokens: Set<string>): boolean {
	if (languageTokens.size === 0) {
		return true;
	}

	const docLanguages = doc.language ?? [];
	if (docLanguages.length === 0) {
		return false;
	}

	return docLanguages.some((language) => {
		const normalized = normalizeLanguageToken(language);
		if (languageTokens.has(normalized)) {
			return true;
		}
		if (normalized.length >= 2 && languageTokens.has(normalized.slice(0, 2))) {
			return true;
		}
		return false;
	});
}

function matchesYearFilter(doc: OpenLibrarySearchDoc, input: SearchBooksRequest): boolean {
	const year = doc.first_publish_year;
	if (typeof year !== 'number' || !Number.isFinite(year)) {
		return true;
	}

	const yearFrom = input.filters?.yearFrom;
	const yearTo = input.filters?.yearTo;
	if (typeof yearFrom === 'number' && year < yearFrom) {
		return false;
	}
	if (typeof yearTo === 'number' && year > yearTo) {
		return false;
	}
	return true;
}

function toSourceUrl(key: string | undefined): string | null {
	if (!hasText(key)) {
		return null;
	}
	return `https://openlibrary.org${key.startsWith('/') ? key : `/${key}`}`;
}

function toCoverUrl(coverId: number | undefined): string | null {
	if (typeof coverId !== 'number' || !Number.isFinite(coverId) || coverId <= 0) {
		return null;
	}
	return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorCode(cause: unknown): string | null {
	if (typeof cause !== 'object' || cause === null) {
		return null;
	}

	const value = cause as ErrorWithCode;
	if (typeof value.code === 'string' && value.code.trim().length > 0) {
		return value.code;
	}
	return null;
}

function isLikelyTransientNetworkError(cause: unknown): boolean {
	if (!(cause instanceof Error)) {
		return false;
	}

	const code = getErrorCode(cause.cause) ?? getErrorCode(cause);
	if (code) {
		return code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'ETIMEDOUT' || code === 'ECONNRESET';
	}

	const message = cause.message.toLowerCase();
	return (
		message.includes('fetch failed') ||
		message.includes('network') ||
		message.includes('timed out') ||
		message.includes('enotfound') ||
		message.includes('eai_again')
	);
}

function describeFailure(cause: unknown): string {
	if (cause instanceof Error) {
		const nestedCode = getErrorCode(cause.cause);
		if (nestedCode) {
			return `${cause.message} (${nestedCode})`;
		}

		return cause.message;
	}

	if (typeof cause === 'string' && cause.length > 0) {
		return cause;
	}

	return 'unknown error';
}

function preferredExtension(input: SearchBooksRequest): string {
	const extensions = input.filters?.extension ?? [];
	const normalized = extensions
		.map((entry) => entry.toLowerCase().trim())
		.find((entry) => entry === 'epub' || entry === 'pdf' || entry === 'mobi');
	return normalized ?? 'epub';
}

function mapBook(doc: OpenLibrarySearchDoc, input: SearchBooksRequest): SearchResultBook | null {
	if (!hasText(doc.title) || !hasText(doc.key)) {
		return null;
	}

	const isbn = doc.isbn?.find((value) => hasText(value)) ?? null;
	const identifier = isbn ?? null;
	const iaId = doc.ia?.find((value) => hasText(value)) ?? null;
	const hasPublicAccessSignal = doc.ebook_access === 'public' || doc.public_scan_b === true;
	const canDownload = hasPublicAccessSignal && Boolean(iaId);
	const extension = preferredExtension(input);

	return {
		provider: 'openlibrary',
		providerBookId: doc.key,
		title: doc.title.trim(),
		author: doc.author_name?.find((value) => hasText(value)) ?? null,
		language: doc.language?.find((value) => hasText(value)) ?? null,
		year:
			typeof doc.first_publish_year === 'number' && Number.isFinite(doc.first_publish_year)
				? doc.first_publish_year
				: null,
		extension: canDownload ? extension : null,
		filesize: null,
		cover: toCoverUrl(doc.cover_i),
		description: null,
		identifier,
		isbn,
		pages:
			typeof doc.number_of_pages_median === 'number' &&
			Number.isFinite(doc.number_of_pages_median) &&
			doc.number_of_pages_median > 0
				? doc.number_of_pages_median
				: null,
		capabilities: {
			...OPENLIBRARY_BOOK_CAPABILITIES,
			filesAvailable: canDownload
		},
		downloadRef: canDownload ? iaId : null,
		queueRef: null,
		sourceUrl: toSourceUrl(doc.key)
	};
}

export class OpenLibrarySearchProvider implements SearchProviderPort {
	readonly id = 'openlibrary' as const;

	private async fetchSearch(url: string): Promise<Response> {
		const maxAttempts = 3;
		let lastError: unknown = null;

		for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
			try {
				return await fetch(url, {
					headers: {
						Accept: 'application/json',
						'User-Agent': 'Sake/1.0 (+https://github.com/Sudashiii/Sake)'
					}
				});
			} catch (cause: unknown) {
				lastError = cause;
				if (attempt >= maxAttempts || !isLikelyTransientNetworkError(cause)) {
					throw cause;
				}
				await sleep(250 * attempt);
			}
		}

		throw lastError ?? new Error('OpenLibrary fetch failed');
	}

	async search(
		input: SearchBooksRequest,
		_context: SearchProviderContext
	): Promise<ApiResult<SearchResultBook[]>> {
		const limit = Math.max(1, Math.min(input.filters?.limitPerProvider ?? 20, 100));
		const fields = encodeURIComponent(
			'key,title,author_name,language,first_publish_year,cover_i,isbn,number_of_pages_median,ebook_access,public_scan_b,ia'
		);
		const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(input.query)}&limit=${limit}&fields=${fields}`;

		try {
			const response = await this.fetchSearch(url);
			if (!response.ok) {
				return apiError(`OpenLibrary search failed with status ${response.status}`, response.status);
			}

			const payload = (await response.json()) as OpenLibrarySearchPayload;
			const docs = payload.docs ?? [];
			const languageTokens = languageFilterTokens(input);

			const books: SearchResultBook[] = [];
			for (const doc of docs) {
				if (!matchesLanguageFilter(doc, languageTokens)) {
					continue;
				}
				if (!matchesYearFilter(doc, input)) {
					continue;
				}
				const mapped = mapBook(doc, input);
				if (mapped) {
					books.push(mapped);
				}
			}

			return apiOk(books);
		} catch (cause: unknown) {
			return apiError(`OpenLibrary search failed: ${describeFailure(cause)}`, 502, cause);
		}
	}
}
