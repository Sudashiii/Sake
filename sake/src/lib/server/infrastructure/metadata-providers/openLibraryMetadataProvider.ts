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
	normalizeForMatch
} from './metadataProviderUtils';

const TOUCHED_FIELDS = new Set([
	'title',
	'authors',
	'description',
	'publisher',
	'pageCount',
	'covers',
	'rating',
	'subjects',
	'language',
	'identifiers'
]);

export class OpenLibraryMetadataProvider implements MetadataProviderPort {
	readonly id: MetadataProviderId = 'openlibrary';

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
		const limit = query.limit ?? 5;
		const targetLangTokens = languageTokens(query.language);
		const preferredLanguage =
			targetLangTokens.find((t) => t.length === 3) ??
			targetLangTokens.find((t) => t.length === 2) ??
			'';

		const queryBase =
			`${query.title ?? ''}${query.author ? ` ${query.author}` : ''}`.trim();

		if (!queryBase) {
			return apiError('No query terms provided', 400);
		}

		const q = encodeURIComponent(
			preferredLanguage ? `${queryBase} language:${preferredLanguage}` : queryBase
		);
		const url =
			`https://openlibrary.org/search.json?q=${q}&limit=${limit}&fields=key,title,author_name,language,cover_i,isbn,publisher,first_sentence,ratings_average,ratings_count,number_of_pages_median,subject`;

		try {
			const response = await fetch(url, {
				headers: { 'User-Agent': 'Sake/1.0 (+https://github.com/Sudashiii/Sake)' }
			});
			if (!response.ok) {
				return apiError(`OpenLibrary API returned ${response.status}`, 502);
			}

			const payload = (await response.json()) as {
				docs?: Array<{
					key?: string;
					title?: string;
					author_name?: string[];
					language?: string[];
					cover_i?: number;
					isbn?: string[];
					publisher?: string[];
					first_sentence?: string | { value?: string };
					ratings_average?: number;
					ratings_count?: number;
					number_of_pages_median?: number;
					subject?: string[];
				}>;
			};

			const docs = payload.docs ?? [];
			if (docs.length === 0) {
				return apiOk([]);
			}

			const normalizedTitle = normalizeForMatch(query.title);
			const normalizedAuthor = normalizeForMatch(query.author);

			const scoreDoc = (doc: (typeof docs)[number]): number => {
				const title = normalizeForMatch(doc.title);
				const authors = doc.author_name ?? [];
				const hasTitleMatch = normalizedTitle.length > 0 && title.includes(normalizedTitle);
				const hasAuthorMatch =
					normalizedAuthor.length > 0 &&
					authors.some((a) => normalizeForMatch(a).includes(normalizedAuthor));
				const pages = asPositiveNumber(doc.number_of_pages_median);
				const langScoreVal = languageScore(targetLangTokens, doc.language ?? []);
				return (hasTitleMatch ? 5 : 0) + (hasAuthorMatch ? 3 : 0) + (pages ? 2 : 0) + langScoreVal;
			};

			const candidates: MetadataCandidate[] = docs.map((doc) => {
				const providerScore = scoreDoc(doc);

				const firstSentence =
					typeof doc.first_sentence === 'string'
						? doc.first_sentence
						: asString(doc.first_sentence?.value);

				const coverUrl =
					typeof doc.cover_i === 'number'
						? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
						: null;

				const isbns = doc.isbn ?? [];
				const isbn13 = asString(isbns.find((isbn) => isbn.length === 13));
				const isbn10 = asString(isbns.find((isbn) => isbn.length === 10));

				return {
					providerId: 'openlibrary',
					providerScore,
					identifiers: {
						isbn10,
						isbn13,
						asin: null,
						googleBooksId: null,
						openLibraryKey: asString(doc.key),
						hardcoverId: null
					},
					title: doc.title ?? '',
					subtitle: null,
					authors: doc.author_name ?? [],
					description: asString(firstSentence),
					descriptionFormat: 'text',
					subjects: doc.subject?.slice(0, 20) ?? [],
					series: null,
					seriesIndex: null,
					publisher: asString(doc.publisher?.[0]),
					publishedDate: { year: null, month: null, day: null },
					language: asString(doc.language?.[0]),
					pageCount: asPositiveNumber(doc.number_of_pages_median),
					covers: coverUrl ? [{ url: coverUrl, source: 'openlibrary' }] : [],
					rating: {
						average: asNonNegativeNumber(doc.ratings_average),
						count: asNonNegativeNumber(doc.ratings_count)
					},
					sourceUrl: doc.key ? `https://openlibrary.org${doc.key}` : null
				} satisfies MetadataCandidate;
			});

			candidates.sort((a, b) => b.providerScore - a.providerScore);
			return apiOk(candidates);
		} catch {
			return apiError('OpenLibrary lookup failed', 502);
		}
	}
}
