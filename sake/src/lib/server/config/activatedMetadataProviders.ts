import { env } from '$env/dynamic/private';
import { METADATA_PROVIDER_IDS, type MetadataProviderId } from '$lib/types/Metadata/Provider';

const PROVIDER_ALIASES: Record<string, MetadataProviderId> = {
	googlebooks: 'googlebooks',
	google: 'googlebooks',
	'google-books': 'googlebooks',
	openlibrary: 'openlibrary',
	openlib: 'openlibrary',
	'open-library': 'openlibrary',
	hardcover: 'hardcover',
	isbndb: 'isbndb',
	isbn: 'isbndb'
};

function normalizeMetadataProviderToken(value: string): MetadataProviderId | null {
	const normalized = value.trim().toLowerCase();
	if (!normalized) {
		return null;
	}
	return PROVIDER_ALIASES[normalized] ?? null;
}

export function parseActivatedMetadataProviders(
	rawValue: string | undefined | null
): MetadataProviderId[] {
	if (!rawValue) {
		return [];
	}

	const parsed = rawValue
		.split(',')
		.map((entry) => normalizeMetadataProviderToken(entry))
		.filter((entry): entry is MetadataProviderId => entry !== null);

	return [...new Set(parsed)];
}

export function getActivatedMetadataProviders(): MetadataProviderId[] {
	return parseActivatedMetadataProviders(env.ACTIVATED_METADATA_PROVIDERS);
}

export function isMetadataLookupEnabled(): boolean {
	return getActivatedMetadataProviders().length > 0;
}

export { METADATA_PROVIDER_IDS };
