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
	languageScore,
	languageTokens,
	normalizeForMatch,
	parseProviderPublicationDate
} from './metadataProviderUtils';

// ---------------------------------------------------------------------------
// Smoothed rate limiter — 60 requests per minute (Hardcover's stated limit)
// ---------------------------------------------------------------------------

const RATE_LIMIT_PER_MINUTE = 60;
const REFILL_INTERVAL_MS = (60 / RATE_LIMIT_PER_MINUTE) * 1_000;

class RequestRateLimiter {
	private nextAllowedAt = 0;

	tryConsume(): boolean {
		const now = Date.now();
		if (now >= this.nextAllowedAt) {
			this.nextAllowedAt = now + REFILL_INTERVAL_MS;
			return true;
		}
		return false;
	}
}

const rateLimiter = new RequestRateLimiter();

// ---------------------------------------------------------------------------
// GraphQL queries — keep selections narrow and only request fields Sake maps.
// ---------------------------------------------------------------------------

const SEARCH_QUERY = /* GraphQL */ `
  query SakeMetadataSearch($query: String!, $limit: Int!) {
    search(query: $query, query_type: "Book", per_page: $limit) {
      results {
        hit {
          id
          title
          description
          rating
          ratings_count
          slug
          cached_contributors
          cached_tags
          default_edition_id
          default_edition {
            isbn_13
            isbn_10
            pages
            release_date
            image { url width height }
            publisher { name }
            language { language }
          }
          book_series {
            position
            series { name }
          }
        }
      }
    }
  }
`;

const ISBN_LOOKUP_QUERY = /* GraphQL */ `
  query SakeMetadataByISBN($isbn: String!, $limit: Int!) {
    books(
      where: { editions: { _or: [{ isbn_13: { _eq: $isbn } }, { isbn_10: { _eq: $isbn } }] } }
      limit: $limit
    ) {
      id
      title
      description
      rating
      ratings_count
      slug
      cached_contributors
      cached_tags
      default_edition {
        isbn_13
        isbn_10
        pages
        release_date
        image { url width height }
        publisher { name }
        language { language }
      }
      book_series {
        position
        series { name }
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Response shape helpers
// ---------------------------------------------------------------------------

interface HardcoverEdition {
	isbn_13?: string | null;
	isbn_10?: string | null;
	pages?: number | null;
	release_date?: string | null;
	image?: { url?: string | null; width?: number | null; height?: number | null } | null;
	publisher?: { name?: string | null } | null;
	language?: { language?: string | null } | null;
}

interface HardcoverSeries {
	position?: number | null;
	series?: { name?: string | null } | null;
}

interface HardcoverBook {
	id?: number | null;
	title?: string | null;
	description?: string | null;
	rating?: number | null;
	ratings_count?: number | null;
	slug?: string | null;
	cached_contributors?: string | null;
	cached_tags?: string | null;
	default_edition?: HardcoverEdition | null;
	book_series?: HardcoverSeries[] | null;
}

interface HardcoverSearchResult {
	data?: {
		search?: {
			results?: Array<{ hit?: HardcoverBook | null } | null> | null;
		} | null;
	} | null;
}

interface HardcoverISBNResult {
	data?: {
		books?: HardcoverBook[] | null;
	} | null;
}

interface GraphQLError {
	message?: string;
}

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

function parseContributors(cached: string | null | undefined): string[] {
	if (!cached) return [];
	try {
		const parsed = JSON.parse(cached) as Array<{ name?: string; author?: { name?: string } }>;
		if (!Array.isArray(parsed)) return [];
		return parsed.flatMap((entry) => {
			const name = asString(entry.name ?? entry.author?.name);
			return name ? [name] : [];
		});
	} catch {
		return [];
	}
}

function parseTags(cached: string | null | undefined): string[] {
	if (!cached) return [];
	try {
		const parsed = JSON.parse(cached) as Array<{ tag?: string; name?: string }>;
		if (!Array.isArray(parsed)) return [];
		return parsed.flatMap((entry) => {
			const tag = asString(entry.tag ?? entry.name);
			return tag ? [tag] : [];
		});
	} catch {
		return [];
	}
}

function mapBookToCandidate(book: HardcoverBook, query: MetadataQuery): MetadataCandidate {
	const edition = book.default_edition;
	const authors = parseContributors(book.cached_contributors);
	const subjects = parseTags(book.cached_tags);

	const normalizedTitle = normalizeForMatch(query.title);
	const normalizedAuthor = normalizeForMatch(query.author);
	const targetLangTokens = languageTokens(query.language);

	const titleMatch =
		normalizedTitle.length > 0 && normalizeForMatch(book.title).includes(normalizedTitle);
	const authorMatch =
		normalizedAuthor.length > 0 &&
		authors.some((a) => normalizeForMatch(a).includes(normalizedAuthor));
	const langScoreVal = languageScore(targetLangTokens, [edition?.language?.language]);

	const providerScore =
		(titleMatch ? 5 : 0) +
		(authorMatch ? 3 : 0) +
		(asPositiveNumber(edition?.pages) ? 2 : 0) +
		langScoreVal;

	const imageUrl = asString(edition?.image?.url);
	const imageWidth = edition?.image?.width ?? undefined;
	const imageHeight = edition?.image?.height ?? undefined;

	const firstSeries = book.book_series?.[0];
	const sourceUrl = book.slug
		? `https://hardcover.app/books/${book.slug}`
		: null;

	return {
		providerId: 'hardcover',
		providerScore,
		identifiers: {
			isbn10: asString(edition?.isbn_10),
			isbn13: asString(edition?.isbn_13),
			asin: null,
			googleBooksId: null,
			openLibraryKey: null,
			hardcoverId: book.id != null ? String(book.id) : null
		},
		title: asString(book.title) ?? '',
		subtitle: null,
		authors,
		description: asString(book.description),
		descriptionFormat: 'markdown',
		subjects,
		series: asString(firstSeries?.series?.name),
		seriesIndex: asNonNegativeNumber(firstSeries?.position),
		publisher: asString(edition?.publisher?.name),
		publishedDate: parseProviderPublicationDate(edition?.release_date ?? null),
		language: asString(edition?.language?.language),
		pageCount: asPositiveNumber(edition?.pages),
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

// ---------------------------------------------------------------------------
// GraphQL fetch helper
// ---------------------------------------------------------------------------

const HARDCOVER_API_URL = 'https://api.hardcover.app/v1/graphql';
const UPSTREAM_TIMEOUT_MS = 30_000;
const USER_AGENT = 'Sake/1.0 (+https://github.com/Sudashiii/Sake)';
const DEFAULT_QUERY_LIMIT = 5;
const MAX_QUERY_LIMIT = 10;

function normalizeLimit(limit: number | undefined): number {
	if (limit == null || !Number.isFinite(limit)) {
		return DEFAULT_QUERY_LIMIT;
	}
	return Math.min(Math.max(Math.floor(limit), 1), MAX_QUERY_LIMIT);
}

async function graphqlFetch<T>(
	token: string,
	query: string,
	variables: Record<string, unknown>
): Promise<T> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

	try {
		const response = await fetch(HARDCOVER_API_URL, {
			method: 'POST',
			signal: controller.signal,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
				'User-Agent': USER_AGENT
			},
			body: JSON.stringify({ query, variables })
		});

		if (!response.ok) {
			throw new Error(`Hardcover API returned HTTP ${response.status}`);
		}

		const json = (await response.json()) as { data?: T; errors?: GraphQLError[] };
		if (json.errors && json.errors.length > 0) {
			throw new Error(json.errors.map((e) => e.message ?? 'unknown error').join('; '));
		}

		return json.data as T;
	} finally {
		clearTimeout(timer);
	}
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
		const token = process.env.HARDCOVER_API_TOKEN?.trim();
		if (!token) {
			return apiError('HARDCOVER_API_TOKEN is not configured', 503);
		}

		if (!rateLimiter.tryConsume()) {
			return apiError('Hardcover rate limit reached; try again shortly', 429);
		}

		const limit = normalizeLimit(query.limit);

		try {
			let books: HardcoverBook[];

			if (query.isbn) {
				const data = await graphqlFetch<HardcoverISBNResult['data']>(
					token,
					ISBN_LOOKUP_QUERY,
					{ isbn: query.isbn, limit }
				);
				books = data?.books ?? [];

				// If ISBN lookup returns nothing, fall through to title search
				if (books.length === 0 && query.title) {
					if (!rateLimiter.tryConsume()) {
						// We're rate-limited on the fallback call — return empty rather than error
						return apiOk([]);
					}
					books = await this.searchByTitle(token, query.title, limit);
				}
			} else if (query.title) {
				books = await this.searchByTitle(token, query.title, limit);
			} else {
				return apiError('No query terms provided for Hardcover lookup', 400);
			}

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

	private async searchByTitle(
		token: string,
		title: string,
		limit: number
	): Promise<HardcoverBook[]> {
		const data = await graphqlFetch<HardcoverSearchResult['data']>(
			token,
			SEARCH_QUERY,
			{ query: title, limit }
		);
		const hits = data?.search?.results ?? [];
		return hits.flatMap((r) => (r?.hit ? [r.hit] : []));
	}
}
