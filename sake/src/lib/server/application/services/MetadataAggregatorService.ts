import type {
	MetadataCandidate,
	MetadataProviderPort,
	MetadataQuery
} from '$lib/server/application/ports/MetadataProviderPort';
import type { MetadataProviderId } from '$lib/types/Metadata/Provider';
import { languageTokens, normalizeForMatch } from '$lib/server/infrastructure/metadata-providers/metadataProviderUtils';
import { createChildLogger } from '$lib/server/infrastructure/logging/logger';

const DEFAULT_TIMEOUT_MS = 8_000;

export interface MetadataAggregatorResult {
	candidates: MetadataCandidate[];
	providerErrors: Array<{ providerId: MetadataProviderId; message: string }>;
}

interface MetadataProviderLookupLogResult {
	providerId: MetadataProviderId;
	status: 'ok' | 'empty' | 'error';
	candidateCount: number;
	message?: string;
}

function readTimeoutMs(): number {
	const raw = process.env.METADATA_PROVIDER_TIMEOUT_MS;
	if (!raw) {
		return DEFAULT_TIMEOUT_MS;
	}
	const parsed = Number.parseInt(raw, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function aggregatorScore(candidate: MetadataCandidate, query: MetadataQuery): number {
	let score = 0;

	if (query.isbn) {
		const { isbn10, isbn13 } = candidate.identifiers;
		if ((isbn13 && isbn13 === query.isbn) || (isbn10 && isbn10 === query.isbn)) {
			score += 4;
		}
	}

	if (candidate.covers.length > 0) {
		score += 2;
	}

	if (query.language && candidate.language) {
		const targetTokens = languageTokens(query.language);
		const candidateTokens = languageTokens(candidate.language);
		score += candidateTokens.some((t) => targetTokens.includes(t)) ? 2 : -1;
	}

	if (query.title && candidate.title) {
		const normalizedQuery = normalizeForMatch(query.title);
		const normalizedTitle = normalizeForMatch(candidate.title);
		if (normalizedQuery.length > 0 && normalizedTitle.includes(normalizedQuery)) {
			score += 1;
		}
	}

	if (candidate.description) {
		score += Math.min(candidate.description.length / 1000, 1);
	}

	return score;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const timeoutPromise = new Promise<T>((_, reject) => {
		timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
	});

	return Promise.race([promise, timeoutPromise]).finally(() => {
		if (timeoutId !== null) {
			clearTimeout(timeoutId);
		}
	});
}

export class MetadataAggregatorService {
	private readonly serviceLogger = createChildLogger({ service: 'MetadataAggregatorService' });

	constructor(private readonly providers: MetadataProviderPort[]) {}

	async lookup(query: MetadataQuery): Promise<MetadataAggregatorResult> {
		const timeoutMs = readTimeoutMs();
		const providerIds = this.providers.map((provider) => provider.id);

		this.serviceLogger.info(
			{
				event: 'metadata.lookup.started',
				providerIds,
				providerCount: providerIds.length,
				timeoutMs,
				query: {
					hasTitle: Boolean(query.title?.trim()),
					hasAuthor: Boolean(query.author?.trim()),
					hasIsbn: Boolean(query.isbn?.trim()),
					hasLanguage: Boolean(query.language?.trim()),
					hasGoogleBooksId: Boolean(query.googleBooksId?.trim()),
					hasOpenLibraryKey: Boolean(query.openLibraryKey?.trim()),
					hasHardcoverId: Boolean(query.hardcoverId?.trim()),
					limit: query.limit ?? null
				}
			},
			'Metadata lookup started'
		);

		const settled = await Promise.allSettled(
			this.providers.map((provider) =>
				withTimeout(
					provider.lookup(query),
					timeoutMs,
					`Metadata provider '${provider.id}'`
				)
			)
		);

		const allCandidates: MetadataCandidate[] = [];
		const providerErrors: Array<{ providerId: MetadataProviderId; message: string }> = [];
		const providerResults: MetadataProviderLookupLogResult[] = [];

		for (let i = 0; i < settled.length; i++) {
			const result = settled[i];
			const provider = this.providers[i];
			if (!provider) continue;

			if (result.status === 'rejected') {
				const message =
					result.reason instanceof Error
						? result.reason.message
						: String(result.reason);
				providerErrors.push({
					providerId: provider.id,
					message
				});
				providerResults.push({
					providerId: provider.id,
					status: 'error',
					candidateCount: 0,
					message
				});
				continue;
			}

			const apiResult = result.value;
			if (!apiResult.ok) {
				providerErrors.push({
					providerId: provider.id,
					message: apiResult.error.message
				});
				providerResults.push({
					providerId: provider.id,
					status: 'error',
					candidateCount: 0,
					message: apiResult.error.message
				});
				continue;
			}

			allCandidates.push(...apiResult.value);
			providerResults.push({
				providerId: provider.id,
				status: apiResult.value.length > 0 ? 'ok' : 'empty',
				candidateCount: apiResult.value.length
			});
		}

		const ranked = allCandidates
			.map((candidate) => ({
				candidate,
				score: aggregatorScore(candidate, query)
			}))
			.sort((a, b) => {
				if (b.score !== a.score) {
					return b.score - a.score;
				}
				return b.candidate.providerScore - a.candidate.providerScore;
			})
			.map(({ candidate }) => candidate);

		this.serviceLogger.info(
			{
				event: 'metadata.lookup.completed',
				providerIds,
				providerResults,
				providersWithCandidates: providerResults
					.filter((result) => result.candidateCount > 0)
					.map((result) => result.providerId),
				candidateCount: ranked.length,
				providerErrorCount: providerErrors.length
			},
			'Metadata lookup completed'
		);

		return { candidates: ranked, providerErrors };
	}
}
