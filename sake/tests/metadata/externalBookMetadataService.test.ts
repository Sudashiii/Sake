import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type {
	MetadataCandidate,
	MetadataProviderCapabilities,
	MetadataProviderPort,
	MetadataQuery
} from '$lib/server/application/ports/MetadataProviderPort';
import { MetadataAggregatorService } from '$lib/server/application/services/MetadataAggregatorService';
import { ExternalBookMetadataService } from '$lib/server/application/services/ExternalBookMetadataService';
import { apiOk, type ApiResult } from '$lib/server/http/api';
import type { MetadataProviderId } from '$lib/types/Metadata/Provider';

function candidate(providerId: MetadataProviderId, title: string): MetadataCandidate {
	return {
		providerId,
		providerScore: 1,
		identifiers: {
			isbn10: null,
			isbn13: '9780593135211',
			asin: null,
			googleBooksId: providerId === 'googlebooks' ? 'gb-project-hail-mary' : null,
			openLibraryKey: providerId === 'openlibrary' ? 'OLproject' : null,
			hardcoverId: providerId === 'hardcover' ? '123' : null
		},
		title,
		subtitle: null,
		authors: ['Andy Weir'],
		description: 'A rescue mission in deep space.',
		descriptionFormat: 'text',
		subjects: [],
		series: null,
		seriesIndex: null,
		publisher: 'Ballantine Books',
		publishedDate: { year: 2021, month: 5, day: 4 },
		language: 'en',
		pageCount: 496,
		covers: [],
		rating: { average: 4.5, count: 100 },
		sourceUrl: null
	};
}

class CapturingProvider implements MetadataProviderPort {
	readonly capabilities: MetadataProviderCapabilities = {
		touchedFields: new Set(['title']),
		hasCover: false,
		hasRating: true,
		requiresIsbn: false
	};
	query: MetadataQuery | null = null;

	constructor(readonly id: MetadataProviderId) {}

	async lookup(query: MetadataQuery): Promise<ApiResult<MetadataCandidate[]>> {
		this.query = query;
		return apiOk([candidate(this.id, query.title ?? 'Unknown')]);
	}
}

describe('ExternalBookMetadataService', () => {
	test('uses the injected metadata aggregator providers', async () => {
		const hardcoverProvider = new CapturingProvider('hardcover');
		const service = new ExternalBookMetadataService(
			new MetadataAggregatorService([hardcoverProvider])
		);

		const metadata = await service.lookup({
			title: 'Project Hail Mary',
			author: 'Andy Weir',
			identifier: '9780593135211',
			language: 'en'
		});

		assert.deepEqual(hardcoverProvider.query, {
			title: 'Project Hail Mary',
			author: 'Andy Weir',
			isbn: '9780593135211',
			language: 'en'
		});
		assert.equal(metadata.identifier, '9780593135211');
		assert.equal(metadata.publisher, 'Ballantine Books');
		assert.equal(metadata.googleBooksId, null);
		assert.equal(metadata.openLibraryKey, null);
	});

	test('has no hardcoded provider fallback when no aggregator is injected', async () => {
		const service = new ExternalBookMetadataService();

		const metadata = await service.lookup({
			title: 'Project Hail Mary',
			author: 'Andy Weir',
			identifier: '9780593135211',
			language: 'en'
		});

		assert.equal(metadata.identifier, '9780593135211');
		assert.equal(metadata.publisher, null);
		assert.equal(metadata.googleBooksId, null);
		assert.equal(metadata.openLibraryKey, null);
	});
});
