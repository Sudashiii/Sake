import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import type {
	MetadataCandidate,
	MetadataProviderCapabilities,
	MetadataProviderPort,
	MetadataQuery
} from '$lib/server/application/ports/MetadataProviderPort';
import type { MetadataProviderId } from '$lib/types/Metadata/Provider';
import {
	asNonNegativeNumber,
	asPositiveNumber,
	asString,
	normalizeForMatch,
	parseProviderPublicationDate
} from './metadataProviderUtils';
import { normalizeAuthorForMatch } from '$lib/utils/author';
import { HardcoverClient } from '$lib/server/infrastructure/clients/HardcoverClient';

// ---------------------------------------------------------------------------
// GraphQL queries — keep selections narrow and only request fields Sake maps.
// ---------------------------------------------------------------------------

const SEARCH_QUERY = /* GraphQL */ `
  query SakeMetadataSearch($query: String!, $limit: Int!) {
    search(query: $query, query_type: "Book", per_page: $limit, page: 1) {
      ids
      results
    }
  }
`;

// ---------------------------------------------------------------------------
// Response shape helpers
// ---------------------------------------------------------------------------

interface HardcoverSearchDocument {
	id?: string | number | null;
	title?: string | null;
	subtitle?: string | null;
	author_names?: string[] | null;
	description?: string | null;
	rating?: number | null;
	ratings_count?: number | null;
	slug?: string | null;
	image?: { url?: string | null; width?: number | null; height?: number | null } | null;
	isbns?: string[] | null;
	pages?: number | null;
	release_date?: string | null;
	release_year?: number | null;
	genres?: string[] | null;
	tags?: string[] | null;
	series_names?: string[] | null;
}

interface HardcoverSearchResult {
	data?: {
		search?: {
			ids?: Array<string | number> | null;
			results?: {
				hits?: Array<{ document?: HardcoverSearchDocument | null } | null> | null;
			} | null;
		} | null;
	} | null;
}

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

function firstMatchingIsbn(isbns: string[], length: 10 | 13, preferred: string | null | undefined): string | null {
	const normalizedPreferred = preferred?.replace(/[^0-9X]/gi, '').toUpperCase() ?? '';
	const matchingPreferred = isbns.find((isbn) => {
		const normalized = isbn.replace(/[^0-9X]/gi, '').toUpperCase();
		return normalized.length === length && normalized === normalizedPreferred;
	});
	if (matchingPreferred) {
		return matchingPreferred;
	}

	return isbns.find((isbn) => isbn.replace(/[^0-9X]/gi, '').length === length) ?? null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
	return [...new Set(values.flatMap((value) => {
		const stringValue = asString(value);
		return stringValue ? [stringValue] : [];
	}))];
}

function mapBookToCandidate(book: HardcoverSearchDocument, query: MetadataQuery): MetadataCandidate {
	const authors = uniqueStrings(book.author_names ?? []);
	const subjects = uniqueStrings([...(book.genres ?? []), ...(book.tags ?? [])]);
	const isbns = uniqueStrings(book.isbns ?? []);
	const isbn13 = firstMatchingIsbn(isbns, 13, query.isbn);
	const isbn10 = firstMatchingIsbn(isbns, 10, query.isbn);

	const normalizedTitle = normalizeForMatch(query.title);
	const normalizedAuthor = normalizeAuthorForMatch(query.author);

	const titleMatch =
		normalizedTitle.length > 0 && normalizeForMatch(book.title).includes(normalizedTitle);
	const authorMatch =
		normalizedAuthor.length > 0 &&
		authors.some((a) => normalizeAuthorForMatch(a).includes(normalizedAuthor));

	const providerScore =
		(titleMatch ? 5 : 0) +
		(authorMatch ? 3 : 0) +
		(asPositiveNumber(book.pages) ? 2 : 0);

	const imageUrl = asString(book.image?.url);
	const imageWidth = book.image?.width ?? undefined;
	const imageHeight = book.image?.height ?? undefined;

	const sourceUrl = book.slug
		? `https://hardcover.app/books/${book.slug}`
		: null;

	return {
		providerId: 'hardcover',
		providerScore,
		identifiers: {
			isbn10: asString(isbn10),
			isbn13: asString(isbn13),
			asin: null,
			googleBooksId: null,
			openLibraryKey: null,
			hardcoverId: book.id != null ? String(book.id) : null
		},
		title: asString(book.title) ?? '',
		subtitle: asString(book.subtitle),
		authors,
		description: asString(book.description),
		descriptionFormat: 'markdown',
		subjects,
		series: asString(book.series_names?.[0]),
		seriesIndex: null,
		publisher: null,
		publishedDate: parseProviderPublicationDate(
			book.release_date ?? (book.release_year != null ? String(book.release_year) : null)
		),
		language: null,
		pageCount: asPositiveNumber(book.pages),
		covers: imageUrl
			? [
					{
						url: imageUrl,
						source: 'hardcover',
						...(imageWidth != null ? { width: imageWidth } : {}),
						...(imageHeight != null ? { height: imageHeight } : {})
					}
				]
			: [],
		rating: {
			average: asNonNegativeNumber(book.rating),
			count: asNonNegativeNumber(book.ratings_count)
		},
		sourceUrl
	} satisfies MetadataCandidate;
}

const DEFAULT_QUERY_LIMIT = 5;
const MAX_QUERY_LIMIT = 10;

function normalizeLimit(limit: number | undefined): number {
	if (limit == null || !Number.isFinite(limit)) {
		return DEFAULT_QUERY_LIMIT;
	}
	return Math.min(Math.max(Math.floor(limit), 1), MAX_QUERY_LIMIT);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const TOUCHED_FIELDS = new Set([
	'title',
	'authors',
	'description',
	'publisher',
	'publishedDate',
	'pageCount',
	'covers',
	'rating',
	'subjects',
	'series',
	'seriesIndex',
	'identifiers'
]);

export class HardcoverMetadataProvider implements MetadataProviderPort {
	readonly id: MetadataProviderId = 'hardcover';

	constructor(
		private readonly apiToken?: string | null,
		private readonly client?: HardcoverClient | null
	) {}

	readonly capabilities: MetadataProviderCapabilities = {
		touchedFields: TOUCHED_FIELDS,
		hasCover: true,
		hasRating: true,
		requiresIsbn: false
	};

	lookup(query: MetadataQuery): Promise<ApiResult<MetadataCandidate[]>> {
		return this.fetchCandidates(query);
	}

	private async fetchCandidates(query: MetadataQuery): Promise<ApiResult<MetadataCandidate[]>> {
		const token = this.apiToken?.trim() || process.env.HARDCOVER_API_TOKEN?.trim();
		if (!token) {
			return apiError('HARDCOVER_API_TOKEN is not configured', 503);
		}

		const limit = normalizeLimit(query.limit);

		try {
			const searchQuery = query.title?.trim() || query.isbn?.trim();
			if (!searchQuery) {
				return apiError('No query terms provided for Hardcover lookup', 400);
			}
			const books = await this.search(this.client ?? new HardcoverClient(token), searchQuery, limit);

			if (books.length === 0) {
				return apiOk([]);
			}

			const candidates = books
				.filter((b) => b.title != null)
				.map((b) => mapBookToCandidate(b, query));

			candidates.sort((a, b) => b.providerScore - a.providerScore);
			return apiOk(candidates);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Hardcover lookup failed';
			return apiError(message, 502);
		}
	}

	private async search(
		client: HardcoverClient,
		searchQuery: string,
		limit: number
	): Promise<HardcoverSearchDocument[]> {
		const data = await client.execute<NonNullable<HardcoverSearchResult['data']>>(SEARCH_QUERY, {
			query: searchQuery,
			limit
		});
		const hits = data?.search?.results?.hits ?? [];
		return hits.flatMap((hit) => (hit?.document ? [hit.document] : []));
	}
}
