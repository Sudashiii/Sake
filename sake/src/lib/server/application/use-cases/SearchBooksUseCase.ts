import type {
	SearchProviderContext,
	SearchProviderPort
} from '$lib/server/application/ports/SearchProviderPort';
import { SearchProviderRegistry } from '$lib/server/application/services/SearchProviderRegistry';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import type { SearchProviderId } from '$lib/types/Search/Provider';
import type { SearchBooksRequest } from '$lib/types/Search/SearchBooksRequest';
import type {
	SearchBooksResponse,
	SearchProviderFailure
} from '$lib/types/Search/SearchBooksResponse';
import type { SearchResultBook } from '$lib/types/Search/SearchResultBook';

interface SearchBooksInput {
	request: SearchBooksRequest;
	context?: SearchProviderContext;
}

function normalizeProviderIds(
	providerIds: SearchProviderId[] | undefined,
	defaultProviderIds: SearchProviderId[]
): SearchProviderId[] {
	const input = providerIds && providerIds.length > 0 ? providerIds : defaultProviderIds;
	return [...new Set(input)];
}

function normalizeQuery(query: string): string {
	return query.trim();
}

export class SearchBooksUseCase {
	private readonly providerRegistry: SearchProviderRegistry;
	private readonly defaultProviderIds: SearchProviderId[];

	constructor(providers: SearchProviderPort[], defaultProviderIds?: SearchProviderId[]) {
		this.providerRegistry = new SearchProviderRegistry(providers);
		this.defaultProviderIds = [...new Set(defaultProviderIds ?? providers.map((provider) => provider.id))];
	}

	async execute(input: SearchBooksInput): Promise<ApiResult<SearchBooksResponse>> {
		const query = normalizeQuery(input.request.query);
		if (!query) {
			return apiError('query is required', 400);
		}

		const requestedProviderIds = normalizeProviderIds(
			input.request.providers,
			this.defaultProviderIds
		);
		const { providers, missingProviderIds } = this.providerRegistry.resolve(requestedProviderIds);

		if (missingProviderIds.length > 0) {
			return apiError(`Unknown providers requested: ${missingProviderIds.join(', ')}`, 400);
		}

		if (providers.length === 0) {
			return apiError('No search providers are configured', 500);
		}

		const searchRequest: SearchBooksRequest = {
			...input.request,
			query,
			providers: requestedProviderIds
		};
		const context = input.context ?? {};

		const searchResults = await Promise.all(
			providers.map(async (provider) => {
				try {
					const result = await provider.search(searchRequest, context);
					return { providerId: provider.id, result };
				} catch (cause: unknown) {
					return {
						providerId: provider.id,
						result: apiError('Provider search failed unexpectedly', 502, cause)
					};
				}
			})
		);

		const books: SearchResultBook[] = [];
		const fulfilledProviders: SearchProviderId[] = [];
		const failedProviders: SearchProviderFailure[] = [];

		for (const providerResult of searchResults) {
			if (!providerResult.result.ok) {
				failedProviders.push({
					provider: providerResult.providerId,
					error: providerResult.result.error.message
				});
				continue;
			}

			fulfilledProviders.push(providerResult.providerId);
			books.push(...providerResult.result.value);
		}

		return apiOk({
			success: true,
			books,
			meta: {
				requestedProviders: requestedProviderIds,
				fulfilledProviders,
				failedProviders
			}
		});
	}
}
