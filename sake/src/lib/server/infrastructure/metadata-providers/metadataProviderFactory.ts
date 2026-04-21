import type { MetadataProviderPort } from '$lib/server/application/ports/MetadataProviderPort';
import type { MetadataProviderId } from '$lib/types/Metadata/Provider';
import { GoogleBooksMetadataProvider } from './googleBooksMetadataProvider';
import { OpenLibraryMetadataProvider } from './openLibraryMetadataProvider';

export function createMetadataProvider(providerId: MetadataProviderId): MetadataProviderPort {
	switch (providerId) {
		case 'googlebooks':
			return new GoogleBooksMetadataProvider();
		case 'openlibrary':
			return new OpenLibraryMetadataProvider();
		case 'hardcover':
			throw new Error('Hardcover metadata provider is not yet implemented');
		case 'isbndb':
			throw new Error('ISBNdb metadata provider is not yet implemented');
		default: {
			const exhaustiveId: never = providerId;
			throw new Error(`Unsupported metadata provider: ${exhaustiveId}`);
		}
	}
}

export function createMetadataProviders(providerIds: MetadataProviderId[]): MetadataProviderPort[] {
	return providerIds.map((id) => createMetadataProvider(id));
}
