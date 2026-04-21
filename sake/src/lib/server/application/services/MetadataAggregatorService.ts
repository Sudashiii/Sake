import type {
	MetadataCandidate,
	MetadataProviderPort,
	MetadataQuery
} from '$lib/server/application/ports/MetadataProviderPort';
import type { MetadataProviderId } from '$lib/types/Metadata/Provider';
import { languageTokens, normalizeForMatch } from '$lib/server/infrastructure/metadata-providers/metadataProviderUtils';

const DEFAULT_TIMEOUT_MS = 8_000;

export interface MetadataAggregatorResult {
	candidates: MetadataCandidate[];
	providerErrors: Array<{ providerId: MetadataProviderId; message: string }>;
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
	constructor(private readonly providers: MetadataProviderPort[]) {}

	async lookup(query: MetadataQuery): Promise<MetadataAggregatorResult> {
		const timeoutMs = readTimeoutMs();

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

		for (let i = 0; i < settled.length; i++) {
			const result = settled[i];
			const provider = this.providers[i];
			if (!provider) continue;

			if (result.status === 'rejected') {
				providerErrors.push({
					providerId: provider.id,
					message:
						result.reason instanceof Error
							? result.reason.message
							: String(result.reason)
				});
				continue;
			}

			const apiResult = result.value;
			if (!apiResult.ok) {
				providerErrors.push({
					providerId: provider.id,
					message: apiResult.error.message
				});
				continue;
			}

			allCandidates.push(...apiResult.value);
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

		return { candidates: ranked, providerErrors };
	}
}
