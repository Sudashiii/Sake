import type { MetadataProviderPort } from '$lib/server/application/ports/MetadataProviderPort';
import type { MetadataProviderId } from '$lib/types/Metadata/Provider';
import { GoogleBooksMetadataProvider } from './googleBooksMetadataProvider';
import { OpenLibraryMetadataProvider } from './openLibraryMetadataProvider';
import { HardcoverMetadataProvider } from './hardcoverMetadataProvider';

export function createMetadataProvider(providerId: MetadataProviderId): MetadataProviderPort | null {
	switch (providerId) {
		case 'googlebooks':
			return new GoogleBooksMetadataProvider();
		case 'openlibrary':
			return new OpenLibraryMetadataProvider();
		case 'hardcover':
			// Only instantiate when token is configured; silently skipped otherwise
			return process.env.HARDCOVER_API_TOKEN?.trim() ? new HardcoverMetadataProvider() : null;
		case 'isbndb':
			return null; // not yet implemented — Phase 6
		default: {
			const exhaustiveId: never = providerId;
			throw new Error(`Unsupported metadata provider: ${exhaustiveId}`);
		}
	}
}

export function createMetadataProviders(providerIds: MetadataProviderId[]): MetadataProviderPort[] {
	return providerIds.flatMap((id) => {
		const provider = createMetadataProvider(id);
		return provider ? [provider] : [];
	});
}
