import type { MetadataProviderPort } from '$lib/server/application/ports/MetadataProviderPort';
import type { MetadataProviderId } from '$lib/types/Metadata/Provider';
import { GoogleBooksMetadataProvider } from './googleBooksMetadataProvider';
import { OpenLibraryMetadataProvider } from './openLibraryMetadataProvider';
import { HardcoverMetadataProvider } from './hardcoverMetadataProvider';
import { IsbnDbMetadataProvider } from './isbndbMetadataProvider';
import type { HardcoverClient } from '$lib/server/infrastructure/clients/HardcoverClient';

export interface MetadataProviderRuntimeConfig {
	googleBooksApiKey?: string | null;
	hardcoverApiToken?: string | null;
	hardcoverClient?: HardcoverClient | null;
	isbnDbApiKey?: string | null;
}

function configuredValue(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

export function createMetadataProvider(
	providerId: MetadataProviderId,
	config: MetadataProviderRuntimeConfig = {}
): MetadataProviderPort | null {
	switch (providerId) {
		case 'googlebooks':
			return new GoogleBooksMetadataProvider(config.googleBooksApiKey);
		case 'openlibrary':
			return new OpenLibraryMetadataProvider();
		case 'hardcover': {
			// Only instantiate when token is configured; silently skipped otherwise
			const token = configuredValue(config.hardcoverApiToken ?? process.env.HARDCOVER_API_TOKEN);
			return token ? new HardcoverMetadataProvider(token, config.hardcoverClient) : null;
		}
		case 'isbndb': {
			// Only instantiate when key is configured; silently skipped otherwise
			const apiKey = configuredValue(config.isbnDbApiKey ?? process.env.ISBNDB_API_KEY);
			return apiKey ? new IsbnDbMetadataProvider(apiKey) : null;
		}
		default: {
			const exhaustiveId: never = providerId;
			throw new Error(`Unsupported metadata provider: ${exhaustiveId}`);
		}
	}
}

export function createMetadataProviders(
	providerIds: MetadataProviderId[],
	config: MetadataProviderRuntimeConfig = {}
): MetadataProviderPort[] {
	return providerIds.flatMap((id) => {
		const provider = createMetadataProvider(id, config);
		return provider ? [provider] : [];
	});
}
