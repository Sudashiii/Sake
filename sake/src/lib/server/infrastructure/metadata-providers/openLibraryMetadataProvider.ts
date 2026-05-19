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
import { normalizeAuthorForMatch } from '$lib/utils/author';

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

interface OpenLibraryDoc {
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
}

interface OpenLibraryPayload {
	docs?: OpenLibraryDoc[];
}

interface OpenLibraryQueryVariant {
	id: 'title' | 'title-language' | 'title-author' | 'title-author-language';
	queryText: string;
	rank: number;
}

interface OpenLibraryVariantResult {
	variant: OpenLibraryQueryVariant;
	docs: OpenLibraryDoc[];
}

const OPEN_LIBRARY_FIELDS =
	'key,title,author_name,language,cover_i,isbn,publisher,first_sentence,ratings_average,ratings_count,number_of_pages_median,subject';

function buildOpenLibraryVariants(input: {
	title: string;
	author: string | null | undefined;
	preferredLanguage: string;
}): OpenLibraryQueryVariant[] {
	const variants: OpenLibraryQueryVariant[] = [
		{
			id: 'title',
			queryText: input.title,
			rank: 1
		}
	];

	if (input.preferredLanguage) {
		variants.push({
			id: 'title-language',
			queryText: `${input.title} language:${input.preferredLanguage}`,
			rank: 2
		});
	}

	if (input.author?.trim()) {
		variants.push({
			id: input.preferredLanguage ? 'title-author-language' : 'title-author',
			queryText: `${input.title} ${input.author.trim()}${
				input.preferredLanguage ? ` language:${input.preferredLanguage}` : ''
			}`,
			rank: input.preferredLanguage ? 3 : 2
		});
	}

	return variants;
}

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

		const queryTitle = query.title?.trim() ?? '';

		if (!queryTitle) {
			return apiError('No query terms provided', 400);
		}

		const variants = buildOpenLibraryVariants({
			title: queryTitle,
			author: query.author,
			preferredLanguage
		});

		try {
			const settled = await Promise.allSettled(
				variants.map((variant) => this.fetchVariant(variant, limit))
			);
			const successfulResults: OpenLibraryVariantResult[] = [];
			const failedResults: string[] = [];

			for (const result of settled) {
				if (result.status === 'fulfilled') {
					successfulResults.push(result.value);
				} else {
					failedResults.push(
						result.reason instanceof Error ? result.reason.message : String(result.reason)
					);
				}
			}

			const selectedResult = successfulResults
				.filter((result) => result.docs.length > 0)
				.sort((a, b) => b.variant.rank - a.variant.rank)[0];

			if (!selectedResult) {
				if (successfulResults.length === 0 && failedResults.length > 0) {
					return apiError(failedResults[0] ?? 'OpenLibrary lookup failed', 502);
				}
				return apiOk([]);
			}

			const docs = selectedResult.docs;
			const normalizedTitle = normalizeForMatch(query.title);
			const normalizedAuthor = normalizeAuthorForMatch(query.author);

			const scoreDoc = (doc: (typeof docs)[number]): number => {
				const title = normalizeForMatch(doc.title);
				const authors = doc.author_name ?? [];
				const hasTitleMatch = normalizedTitle.length > 0 && title.includes(normalizedTitle);
				const hasAuthorMatch =
					normalizedAuthor.length > 0 &&
					authors.some((a) => normalizeAuthorForMatch(a).includes(normalizedAuthor));
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

	private async fetchVariant(
		variant: OpenLibraryQueryVariant,
		limit: number
	): Promise<OpenLibraryVariantResult> {
		const url =
			`https://openlibrary.org/search.json?q=${encodeURIComponent(variant.queryText)}&limit=${limit}&fields=${OPEN_LIBRARY_FIELDS}`;

		const response = await fetch(url, {
			headers: { 'User-Agent': 'Sake/1.0 (+https://github.com/Sudashiii/Sake)' }
		});
		if (!response.ok) {
			throw new Error(`OpenLibrary API returned ${response.status}`);
		}

		const payload = (await response.json()) as OpenLibraryPayload;

		return {
			variant,
			docs: payload.docs ?? []
		};
	}
}
