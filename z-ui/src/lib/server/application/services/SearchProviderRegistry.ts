import type { SearchProviderPort } from '$lib/server/application/ports/SearchProviderPort';
import type { SearchProviderId } from '$lib/types/Search/Provider';

interface ResolveProvidersResult {
	providers: SearchProviderPort[];
	missingProviderIds: SearchProviderId[];
}

export class SearchProviderRegistry {
	private readonly providersById = new Map<SearchProviderId, SearchProviderPort>();

	constructor(providers: SearchProviderPort[]) {
		for (const provider of providers) {
			this.providersById.set(provider.id, provider);
		}
	}

	listAvailableProviderIds(): SearchProviderId[] {
		return [...this.providersById.keys()];
	}

	resolve(providerIds: SearchProviderId[]): ResolveProvidersResult {
		const providers: SearchProviderPort[] = [];
		const missingProviderIds: SearchProviderId[] = [];

		for (const providerId of providerIds) {
			const provider = this.providersById.get(providerId);
			if (!provider) {
				missingProviderIds.push(providerId);
				continue;
			}
			providers.push(provider);
		}

		return { providers, missingProviderIds };
	}
}
