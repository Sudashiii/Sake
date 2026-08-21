import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { SearchProviderPort } from '$lib/server/application/ports/SearchProviderPort';
import { SearchBooksUseCase } from '$lib/server/application/use-cases/SearchBooksUseCase';
import { apiError, apiOk } from '$lib/server/http/api';
import type { SearchResultBook } from '$lib/types/Search/SearchResultBook';

function createBook(provider: SearchResultBook['provider']): SearchResultBook {
	return {
		provider,
		providerBookId: `${provider}-book`,
		title: `${provider} result`,
		author: null,
		language: null,
		year: null,
		extension: null,
		filesize: null,
		cover: null,
		description: null,
		series: null,
		volume: null,
		seriesIndex: null,
		identifier: null,
		isbn: null,
		pages: null,
		capabilities: { filesAvailable: false, metadataCompleteness: 'low' },
		downloadRef: null,
		queueRef: null,
		sourceUrl: null
	};
}

describe('SearchBooksUseCase', () => {
	test('keeps fulfilled provider results when Anna search fails', async () => {
		const providers: SearchProviderPort[] = [
			{
				id: 'anna',
				async search() {
					return apiError(
						"Anna's Archive search was blocked by browser verification on all configured mirrors.",
						502
					);
				}
			},
			{
				id: 'openlibrary',
				async search() {
					return apiOk([createBook('openlibrary')]);
				}
			}
		];

		const result = await new SearchBooksUseCase(providers).execute({
			request: { query: 'A book', providers: ['anna', 'openlibrary'] }
		});

		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.deepEqual(result.value.books.map((book) => book.provider), ['openlibrary']);
		assert.deepEqual(result.value.meta.fulfilledProviders, ['openlibrary']);
		assert.deepEqual(result.value.meta.failedProviders, [
			{
				provider: 'anna',
				error: "Anna's Archive search was blocked by browser verification on all configured mirrors."
			}
		]);
	});
});
