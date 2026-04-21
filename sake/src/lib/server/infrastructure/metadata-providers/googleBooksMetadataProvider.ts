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

const TOUCHED_FIELDS = new Set([
	'title',
	'subtitle',
	'authors',
	'description',
	'publisher',
	'publishedDate',
	'pageCount',
	'covers',
	'rating',
	'identifiers'
]);

export class GoogleBooksMetadataProvider implements MetadataProviderPort {
	readonly id: MetadataProviderId = 'googlebooks';

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
		const apiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim() || '';
		const limit = query.limit ?? 5;

		const queryParts: string[] = [];
		if (query.title) {
			queryParts.push(`intitle:${query.title}`);
		}
		if (query.author) {
			queryParts.push(`inauthor:${query.author}`);
		}
		if (query.isbn) {
			queryParts.push(`isbn:${query.isbn}`);
		}

		if (queryParts.length === 0) {
			return apiError('No query terms provided', 400);
		}

		const q = encodeURIComponent(queryParts.join(' '));
		const langTokens = languageTokens(query.language);
		const langRestrict = langTokens.find((t) => t.length === 2) ?? '';
		const langPart = langRestrict ? `&langRestrict=${encodeURIComponent(langRestrict)}` : '';
		const keyPart = apiKey ? `&key=${encodeURIComponent(apiKey)}` : '';
		const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=${limit}${langPart}${keyPart}`;

		try {
			const response = await fetch(url, {
				headers: { 'User-Agent': 'Sake/1.0 (+https://github.com/Sudashiii/Sake)' }
			});
			if (!response.ok) {
				return apiError(`Google Books API returned ${response.status}`, 502);
			}

			const payload = (await response.json()) as {
				items?: Array<{
					id?: string;
					volumeInfo?: {
						title?: string;
						subtitle?: string;
						authors?: string[];
						language?: string;
						publisher?: string;
						description?: string;
						pageCount?: number;
						averageRating?: number;
						ratingsCount?: number;
						publishedDate?: string;
						imageLinks?: { thumbnail?: string; smallThumbnail?: string };
						industryIdentifiers?: Array<{ type?: string; identifier?: string }>;
						infoLink?: string;
					};
				}>;
			};

			const items = payload.items ?? [];
			if (items.length === 0) {
				return apiOk([]);
			}

			const normalizedTitle = normalizeForMatch(query.title);
			const normalizedAuthor = normalizeForMatch(query.author);
			const targetLangTokens = languageTokens(query.language);

			const scoreItem = (item: (typeof items)[number]): number => {
				const title = normalizeForMatch(item.volumeInfo?.title);
				const authors = item.volumeInfo?.authors ?? [];
				const hasTitleMatch = normalizedTitle.length > 0 && title.includes(normalizedTitle);
				const hasAuthorMatch =
					normalizedAuthor.length > 0 &&
					authors.some((a) => normalizeForMatch(a).includes(normalizedAuthor));
				const pages = asPositiveNumber(item.volumeInfo?.pageCount);
				const langScoreVal = languageScore(targetLangTokens, [item.volumeInfo?.language]);
				return (hasTitleMatch ? 5 : 0) + (hasAuthorMatch ? 3 : 0) + (pages ? 2 : 0) + langScoreVal;
			};

			const candidates: MetadataCandidate[] = items.map((item) => {
				const providerScore = scoreItem(item);
				const pubDate = parseProviderPublicationDate(item.volumeInfo?.publishedDate);
				const identifiers = item.volumeInfo?.industryIdentifiers ?? [];
				const isbn13 = asString(identifiers.find((id) => id.type === 'ISBN_13')?.identifier);
				const isbn10 = asString(identifiers.find((id) => id.type === 'ISBN_10')?.identifier);

				const coverUrl =
					asString(item.volumeInfo?.imageLinks?.thumbnail) ??
					asString(item.volumeInfo?.imageLinks?.smallThumbnail);

				return {
					providerId: 'googlebooks',
					providerScore,
					identifiers: {
						isbn10,
						isbn13,
						asin: null,
						googleBooksId: asString(item.id),
						openLibraryKey: null,
						hardcoverId: null
					},
					title: item.volumeInfo?.title ?? '',
					subtitle: asString(item.volumeInfo?.subtitle),
					authors: item.volumeInfo?.authors ?? [],
					description: asString(item.volumeInfo?.description),
					descriptionFormat: 'html',
					subjects: [],
					series: null,
					seriesIndex: null,
					publisher: asString(item.volumeInfo?.publisher),
					publishedDate: pubDate,
					language: asString(item.volumeInfo?.language),
					pageCount: asPositiveNumber(item.volumeInfo?.pageCount),
					covers: coverUrl ? [{ url: coverUrl, source: 'googlebooks' }] : [],
					rating: {
						average: asNonNegativeNumber(item.volumeInfo?.averageRating),
						count: asNonNegativeNumber(item.volumeInfo?.ratingsCount)
					},
					sourceUrl: asString(item.volumeInfo?.infoLink)
				} satisfies MetadataCandidate;
			});

			candidates.sort((a, b) => b.providerScore - a.providerScore);
			return apiOk(candidates);
		} catch {
			return apiError('Google Books lookup failed', 502);
		}
	}
}
