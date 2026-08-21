import type { SearchProviderPort } from '$lib/server/application/ports/SearchProviderPort';
import type { ZLibraryPort } from '$lib/server/application/ports/ZLibraryPort';
import { AnnaArchiveSearchProvider } from '$lib/server/infrastructure/search-providers/AnnaArchiveSearchProvider';
import { GutenbergSearchProvider } from '$lib/server/infrastructure/search-providers/GutenbergSearchProvider';
import { OpenLibrarySearchProvider } from '$lib/server/infrastructure/search-providers/OpenLibrarySearchProvider';
import { ZLibrarySearchProvider } from '$lib/server/infrastructure/search-providers/ZLibrarySearchProvider';
import type { SearchProviderId } from '$lib/types/Search/Provider';

interface SearchProviderFactoryDependencies {
	zlibrary: ZLibraryPort;
}

export function createSearchProvider(
	providerId: SearchProviderId,
	dependencies: SearchProviderFactoryDependencies
): SearchProviderPort {
	switch (providerId) {
		case 'zlibrary':
			return new ZLibrarySearchProvider(dependencies.zlibrary);
		case 'anna':
			return new AnnaArchiveSearchProvider();
		case 'openlibrary':
			return new OpenLibrarySearchProvider();
		case 'gutenberg':
			return new GutenbergSearchProvider();
		default: {
			const exhaustiveProviderId: never = providerId;
			throw new Error(`Unsupported search provider: ${exhaustiveProviderId}`);
		}
	}
}

export function createSearchProviders(
	providerIds: SearchProviderId[],
	dependencies: SearchProviderFactoryDependencies
): SearchProviderPort[] {
	return providerIds.map((providerId) => createSearchProvider(providerId, dependencies));
}
