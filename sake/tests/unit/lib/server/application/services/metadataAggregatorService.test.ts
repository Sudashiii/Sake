import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import type {
	MetadataCandidate,
	MetadataProviderCapabilities,
	MetadataProviderPort,
	MetadataQuery
} from '$lib/server/application/ports/MetadataProviderPort';
import { MetadataAggregatorService } from '$lib/server/application/services/MetadataAggregatorService';
import { apiOk, type ApiResult } from '$lib/server/http/api';
import type { MetadataProviderId } from '$lib/types/Metadata/Provider';

function candidate(providerId: MetadataProviderId): MetadataCandidate {
	return {
		providerId,
		providerScore: 1,
		identifiers: {
			isbn10: null,
			isbn13: null,
			asin: null,
			googleBooksId: null,
			openLibraryKey: null,
			hardcoverId: null
		},
		title: 'Dune',
		subtitle: null,
		authors: ['Frank Herbert'],
		description: null,
		descriptionFormat: 'text',
		subjects: [],
		series: null,
		seriesIndex: null,
		publisher: null,
		publishedDate: { year: 1965, month: 8, day: 1 },
		language: 'en',
		pageCount: 688,
		covers: [],
		rating: { average: null, count: null },
		sourceUrl: null
	};
}

class DelayedProvider implements MetadataProviderPort {
	readonly capabilities: MetadataProviderCapabilities = {
		touchedFields: new Set(['title']),
		hasCover: false,
		hasRating: false,
		requiresIsbn: false
	};

	constructor(
		readonly id: MetadataProviderId,
		private readonly delayMs: number
	) {}

	async lookup(_query: MetadataQuery): Promise<ApiResult<MetadataCandidate[]>> {
		await new Promise((resolve) => setTimeout(resolve, this.delayMs));
		return apiOk([candidate(this.id)]);
	}
}

describe('MetadataAggregatorService', () => {
	const originalTimeout = process.env.METADATA_PROVIDER_TIMEOUT_MS;

	afterEach(() => {
		if (originalTimeout === undefined) {
			delete process.env.METADATA_PROVIDER_TIMEOUT_MS;
		} else {
			process.env.METADATA_PROVIDER_TIMEOUT_MS = originalTimeout;
		}
	});

	test('uses the default timeout when the env override is unset or invalid', async () => {
		process.env.METADATA_PROVIDER_TIMEOUT_MS = '0';
		const service = new MetadataAggregatorService([new DelayedProvider('openlibrary', 10)]);

		const result = await service.lookup({ title: 'Dune' });

		assert.equal(result.providerErrors.length, 0);
		assert.equal(result.candidates.length, 1);
		assert.equal(result.candidates[0]?.providerId, 'openlibrary');
	});

	test('uses the configured timeout override for slow providers', async () => {
		process.env.METADATA_PROVIDER_TIMEOUT_MS = '1';
		const service = new MetadataAggregatorService([new DelayedProvider('openlibrary', 20)]);

		const result = await service.lookup({ title: 'Dune' });

		assert.equal(result.candidates.length, 0);
		assert.equal(result.providerErrors.length, 1);
		assert.equal(result.providerErrors[0]?.providerId, 'openlibrary');
		assert.match(result.providerErrors[0]?.message ?? '', /timed out after 1ms/);
	});
});
