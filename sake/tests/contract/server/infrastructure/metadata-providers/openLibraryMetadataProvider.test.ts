import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { OpenLibraryMetadataProvider } from '$lib/server/infrastructure/metadata-providers/openLibraryMetadataProvider';

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

describe('OpenLibraryMetadataProvider', () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	test('runs fallback query variants and prefers the richest non-empty result', async () => {
		const requestedQueries: string[] = [];

		globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
			const requestUrl = new URL(String(input));
			assert.equal(requestUrl.origin, 'https://openlibrary.org');
			assert.equal(requestUrl.pathname, '/search.json');
			requestedQueries.push(requestUrl.searchParams.get('q') ?? '');

			const query = requestUrl.searchParams.get('q') ?? '';
			if (query === 'Harry Potter und der Stein der Weisen') {
				return jsonResponse({
					docs: [
						{
							key: '/works/OL-title-only',
							title: 'Harry Potter und der Stein der Weisen',
							author_name: ['Different Author'],
							language: ['ger']
						}
					]
				});
			}

			if (query === 'Harry Potter und der Stein der Weisen language:de') {
				return jsonResponse({
					docs: [
						{
							key: '/works/OL-title-language',
							title: 'Harry Potter und der Stein der Weisen',
							author_name: ['J. K. Rowling'],
							language: ['ger']
						}
					]
				});
			}

			if (query === 'Harry Potter und der Stein der Weisen Joanne K. Rowling language:de') {
				return jsonResponse({
					docs: [
						{
							key: '/works/OL-richest',
							title: 'Harry Potter und der Stein der Weisen',
							author_name: ['J. K. Rowling'],
							language: ['ger'],
							isbn: ['9783551551672'],
							cover_i: 123
						}
					]
				});
			}

			throw new Error(`Unexpected query: ${query}`);
		};

		const provider = new OpenLibraryMetadataProvider();
		const result = await provider.lookup({
			title: 'Harry Potter und der Stein der Weisen',
			author: 'Joanne K. Rowling',
			isbn: null,
			language: 'de'
		});

		assert.equal(result.ok, true);
		if (!result.ok) return;

		assert.deepEqual(requestedQueries.sort(), [
			'Harry Potter und der Stein der Weisen',
			'Harry Potter und der Stein der Weisen Joanne K. Rowling language:de',
			'Harry Potter und der Stein der Weisen language:de'
		]);
		assert.equal(result.value.length, 1);
		assert.equal(result.value[0]?.identifiers.openLibraryKey, '/works/OL-richest');
		assert.equal(result.value[0]?.identifiers.isbn13, '9783551551672');
		assert.equal(result.value[0]?.covers[0]?.url, 'https://covers.openlibrary.org/b/id/123-L.jpg');
	});

	test('skips language and author variants when their query inputs are missing', async () => {
		const requestedQueries: string[] = [];

		globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
			const requestUrl = new URL(String(input));
			requestedQueries.push(requestUrl.searchParams.get('q') ?? '');
			return jsonResponse({ docs: [] });
		};

		const provider = new OpenLibraryMetadataProvider();
		const result = await provider.lookup({
			title: 'Dune'
		});

		assert.equal(result.ok, true);
		assert.deepEqual(requestedQueries, ['Dune']);
	});
});
