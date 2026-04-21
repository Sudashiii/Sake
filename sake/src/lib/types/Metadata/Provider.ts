export const METADATA_PROVIDER_IDS = ['googlebooks', 'openlibrary', 'hardcover', 'isbndb'] as const;

export type MetadataProviderId = (typeof METADATA_PROVIDER_IDS)[number];
