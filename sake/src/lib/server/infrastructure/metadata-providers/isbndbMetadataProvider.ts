import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import type {
	MetadataCandidate,
	MetadataProviderCapabilities,
	MetadataProviderPort,
	MetadataQuery
} from '$lib/server/application/ports/MetadataProviderPort';
import type { MetadataProviderId } from '$lib/types/Metadata/Provider';
import {
	asString,
	languageScore,
	languageTokens,
	normalizeForMatch,
	parseProviderPublicationDate
} from './metadataProviderUtils';
import { normalizeAuthorForMatch } from '$lib/utils/author';

const ISBNDB_API_BASE_URL = 'https://api.isbndb.com';
const DEFAULT_QUERY_LIMIT = 5;
const MAX_QUERY_LIMIT = 10;
const USER_AGENT = 'Sake/1.0 (+https://github.com/Sudashiii/Sake)';

const TOUCHED_FIELDS = new Set([
	'title',
	'authors',
	'description',
	'publisher',
	'publishedDate',
	'pageCount',
	'covers',
	'subjects',
	'language',
	'identifiers'
]);

interface IsbnDbBook {
	authors?: unknown;
	date_published?: unknown;
	excerpt?: unknown;
	image?: unknown;
	cover?: unknown;
	isbn?: unknown;
	isbn13?: unknown;
	language?: unknown;
	overview?: unknown;
	pages?: unknown;
	publisher?: unknown;
	subjects?: unknown;
	synopsis?: unknown;
	synopsys?: unknown;
	title?: unknown;
	title_long?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.flatMap((entry) => {
			const text = asString(entry);
			return text ? [text] : [];
		});
	}

	const text = asString(value);
	return text ? [text] : [];
}

function positiveNumber(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
		return value;
	}

	if (typeof value === 'string') {
		const parsed = Number.parseInt(value, 10);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
	}

	return null;
}

function normalizeLimit(limit: number | undefined): number {
	if (limit == null || !Number.isFinite(limit)) {
		return DEFAULT_QUERY_LIMIT;
	}
	return Math.min(Math.max(Math.floor(limit), 1), MAX_QUERY_LIMIT);
}

function normalizeIsbn(value: string | null | undefined): string {
	return (value ?? '').replace(/[^0-9Xx]/g, '').toUpperCase();
}

function extractBooks(payload: unknown): IsbnDbBook[] {
	if (Array.isArray(payload)) {
		return payload.filter(isRecord);
	}

	if (!isRecord(payload)) {
		return [];
	}

	if (isRecord(payload.book)) {
		return [payload.book];
	}

	if (Array.isArray(payload.books)) {
		return payload.books.filter(isRecord);
	}

	if ('title' in payload || 'title_long' in payload || 'isbn' in payload || 'isbn13' in payload) {
		return [payload];
	}

	return [];
}

function firstDescription(book: IsbnDbBook): string | null {
	return (
		asString(book.overview) ??
		asString(book.synopsys) ??
		asString(book.synopsis) ??
		asString(book.excerpt)
	);
}

function scoreBook(book: IsbnDbBook, query: MetadataQuery): number {
	const targetIsbn = normalizeIsbn(query.isbn);
	const isbn10 = normalizeIsbn(asString(book.isbn));
	const isbn13 = normalizeIsbn(asString(book.isbn13));
	const title = asString(book.title_long) ?? asString(book.title) ?? '';
	const authors = stringArray(book.authors);
	const targetLangTokens = languageTokens(query.language);

	const normalizedTitle = normalizeForMatch(query.title);
	const normalizedAuthor = normalizeAuthorForMatch(query.author);
	const hasTitleMatch =
		normalizedTitle.length > 0 && normalizeForMatch(title).includes(normalizedTitle);
	const hasAuthorMatch =
		normalizedAuthor.length > 0 &&
		authors.some((author) => normalizeAuthorForMatch(author).includes(normalizedAuthor));
	const hasIsbnMatch =
		targetIsbn.length > 0 && (targetIsbn === isbn10 || targetIsbn === isbn13);
	const hasCover = Boolean(asString(book.image) ?? asString(book.cover));
	const hasDescription = Boolean(firstDescription(book));

	return (
		(hasIsbnMatch ? 10 : 0) +
		(hasTitleMatch ? 5 : 0) +
		(hasAuthorMatch ? 3 : 0) +
		languageScore(targetLangTokens, [asString(book.language)]) +
		(positiveNumber(book.pages) ? 2 : 0) +
		(hasCover ? 1 : 0) +
		(hasDescription ? 1 : 0)
	);
}

function mapBookToCandidate(book: IsbnDbBook, query: MetadataQuery): MetadataCandidate {
	const isbn10 = asString(book.isbn);
	const isbn13 = asString(book.isbn13);
	const title = asString(book.title_long) ?? asString(book.title) ?? '';
	const imageUrl = asString(book.image) ?? asString(book.cover);
	const sourceIsbn = isbn13 ?? isbn10;

	return {
		providerId: 'isbndb',
		providerScore: scoreBook(book, query),
		identifiers: {
			isbn10,
			isbn13,
			asin: null,
			googleBooksId: null,
			openLibraryKey: null,
			hardcoverId: null
		},
		title,
		subtitle: null,
		authors: stringArray(book.authors),
		description: firstDescription(book),
		descriptionFormat: 'text',
		subjects: stringArray(book.subjects).slice(0, 20),
		series: null,
		seriesIndex: null,
		publisher: asString(book.publisher),
		publishedDate: parseProviderPublicationDate(asString(book.date_published)),
		language: asString(book.language),
		pageCount: positiveNumber(book.pages),
		covers: imageUrl ? [{ url: imageUrl, source: 'isbndb' }] : [],
		rating: { average: null, count: null },
		sourceUrl: sourceIsbn ? `https://isbndb.com/book/${encodeURIComponent(sourceIsbn)}` : null
	} satisfies MetadataCandidate;
}

async function fetchJson(url: string, apiKey: string): Promise<ApiResult<unknown>> {
	try {
		const response = await fetch(url, {
			headers: {
				Accept: 'application/json',
				'User-Agent': USER_AGENT,
				'x-api-key': apiKey
			}
		});

		if (response.status === 404) {
			return apiOk({ books: [] });
		}

		if (response.status === 401 || response.status === 403) {
			return apiError('ISBNdb API key was rejected', response.status);
		}

		if (!response.ok) {
			return apiError(`ISBNdb API returned ${response.status}`, 502);
		}

		return apiOk(await response.json());
	} catch (cause: unknown) {
		return apiError('ISBNdb lookup failed', 502, cause);
	}
}

export class IsbnDbMetadataProvider implements MetadataProviderPort {
	readonly id: MetadataProviderId = 'isbndb';

	constructor(private readonly apiKey?: string | null) {}

	readonly capabilities: MetadataProviderCapabilities = {
		touchedFields: TOUCHED_FIELDS,
		hasCover: true,
		hasRating: false,
		requiresIsbn: false
	};

	async lookup(query: MetadataQuery): Promise<ApiResult<MetadataCandidate[]>> {
		const apiKey = this.apiKey?.trim() || process.env.ISBNDB_API_KEY?.trim();
		if (!apiKey) {
			return apiError('ISBNDB_API_KEY is not configured', 503);
		}

		const limit = normalizeLimit(query.limit);

		if (query.isbn) {
			const result = await this.lookupByIsbn(apiKey, query.isbn, query);
			if (!result.ok || result.value.length > 0 || !query.title) {
				return result;
			}
		}

		if (query.title) {
			return this.searchByTitle(apiKey, query, limit);
		}

		return apiError('No query terms provided for ISBNdb lookup', 400);
	}

	private async lookupByIsbn(
		apiKey: string,
		isbn: string,
		query: MetadataQuery
	): Promise<ApiResult<MetadataCandidate[]>> {
		const url = `${ISBNDB_API_BASE_URL}/book/${encodeURIComponent(isbn)}`;
		const result = await fetchJson(url, apiKey);
		if (!result.ok) {
			return result;
		}

		const candidates = extractBooks(result.value).map((book) => mapBookToCandidate(book, query));
		candidates.sort((a, b) => b.providerScore - a.providerScore);
		return apiOk(candidates);
	}

	private async searchByTitle(
		apiKey: string,
		query: MetadataQuery,
		limit: number
	): Promise<ApiResult<MetadataCandidate[]>> {
		const url = new URL(`${ISBNDB_API_BASE_URL}/books/${encodeURIComponent(query.title ?? '')}`);
		url.searchParams.set('page', '1');
		url.searchParams.set('pageSize', String(limit));
		if (query.author) {
			url.searchParams.set('author', query.author);
		}

		const result = await fetchJson(url.toString(), apiKey);
		if (!result.ok) {
			return result;
		}

		const candidates = extractBooks(result.value).map((book) => mapBookToCandidate(book, query));
		candidates.sort((a, b) => b.providerScore - a.providerScore);
		return apiOk(candidates);
	}
}
