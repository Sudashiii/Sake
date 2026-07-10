import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { queueSearchBookToLibrary } from '$lib/client/routes/queueSearchBookToLibrary';
import type { SearchResultBook } from '$lib/types/Search/SearchResultBook';

const gutenbergBook: SearchResultBook = {
	provider: 'gutenberg',
	providerBookId: '1342',
	title: 'Pride and Prejudice',
	author: 'Jane Austen',
	language: 'en',
	year: 1813,
	extension: 'epub',
	filesize: 123456,
	cover: null,
	description: 'A classic novel.',
	series: null,
	volume: null,
	seriesIndex: null,
	identifier: 'PG1342',
	isbn: null,
	pages: 432,
	capabilities: {
		filesAvailable: true,
		metadataCompleteness: 'medium'
	},
	downloadRef: 'https://www.gutenberg.org/ebooks/1342.epub.images',
	queueRef: null,
	sourceUrl: 'https://www.gutenberg.org/ebooks/1342'
};

describe('queueSearchBookToLibrary', () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			assert.equal(String(input), '/api/search/queue');
			assert.equal(init?.method, 'POST');
			assert.equal(init?.headers && 'Content-Type' in init.headers ? init.headers['Content-Type'] : 'application/json', 'application/json');
			assert.equal(typeof init?.body, 'string');

			const body = JSON.parse(String(init?.body));
			assert.deepEqual(body, {
				provider: 'gutenberg',
				providerBookId: '1342',
				downloadRef: 'https://www.gutenberg.org/ebooks/1342.epub.images',
				title: 'Pride and Prejudice',
				extension: 'epub',
				author: 'Jane Austen',
				series: null,
				volume: null,
				seriesIndex: null,
				identifier: 'PG1342',
				pages: 432,
				description: 'A classic novel.',
				cover: null,
				filesize: 123456,
				language: 'en',
				year: 1813
			});

			return new Response(
				JSON.stringify({
					taskId: 'task-123',
					message: 'Provider import queued successfully',
					queueStatus: { pending: 1, processing: 0 }
				}),
				{
					status: 200,
					headers: {
						'content-type': 'application/json'
					}
				}
			);
		};
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	test('queues provider imports through the search queue endpoint', async () => {
		const result = await queueSearchBookToLibrary(gutenbergBook);

		assert.equal(result.ok, true);
		if (!result.ok) {
			return;
		}

		assert.deepEqual(result.value, {
			taskId: 'task-123',
			message: 'Provider import queued successfully',
			queueStatus: { pending: 1, processing: 0 },
			mode: 'queued'
		});
	});
});
