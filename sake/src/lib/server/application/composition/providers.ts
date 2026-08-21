import { env } from '$env/dynamic/private';
import { MetadataAggregatorService } from '$lib/server/application/services/MetadataAggregatorService';
import { ExternalBookMetadataService } from '$lib/server/application/services/ExternalBookMetadataService';
import { createMetadataProviders } from '$lib/server/infrastructure/metadata-providers/metadataProviderFactory';
import { getActivatedMetadataProviders } from '$lib/server/config/activatedMetadataProviders';
import { createSearchProviders } from '$lib/server/infrastructure/search-providers/searchProviderFactory';
import { getActivatedSearchProviders } from '$lib/server/config/activatedProviders';
import { SEARCH_PROVIDER_IDS } from '$lib/types/Search/Provider';
import {
	hardcoverApiToken,
	hardcoverClient,
	zlibraryClient
} from './foundation';

export const activatedMetadataProviders = createMetadataProviders(getActivatedMetadataProviders(), {
	googleBooksApiKey: env.GOOGLE_BOOKS_API_KEY,
	hardcoverApiToken,
	hardcoverClient,
	isbnDbApiKey: env.ISBNDB_API_KEY
});
export const activatedMetadataAggregator = new MetadataAggregatorService(activatedMetadataProviders);
export const externalBookMetadataService = new ExternalBookMetadataService(
	activatedMetadataAggregator
);

export const activeSearchProviders = getActivatedSearchProviders();
const searchProviderDependencies = { zlibrary: zlibraryClient };

export const activeSearchProviderInstances = createSearchProviders(
	activeSearchProviders,
	searchProviderDependencies
);
export const allSearchProviderInstances = createSearchProviders(
	[...SEARCH_PROVIDER_IDS],
	searchProviderDependencies
);
