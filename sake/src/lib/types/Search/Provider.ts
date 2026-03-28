export const SEARCH_PROVIDER_IDS = ['zlibrary', 'anna', 'openlibrary', 'gutenberg'] as const;

export type SearchProviderId = (typeof SEARCH_PROVIDER_IDS)[number];

export interface SearchProviderCapabilities {
	filesAvailable: boolean;
	metadataCompleteness: 'low' | 'medium' | 'high';
}
