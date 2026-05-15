import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { createMetadataProvider } from '$lib/server/infrastructure/metadata-providers/metadataProviderFactory';
import { IsbnDbMetadataProvider } from '$lib/server/infrastructure/metadata-providers/isbndbMetadataProvider';

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

describe('IsbnDbMetadataProvider', () => {
	const originalFetch = globalThis.fetch;
	const originalApiKey = process.env.ISBNDB_API_KEY;

	afterEach(() => {
		globalThis.fetch = originalFetch;
		if (originalApiKey === undefined) {
			delete process.env.ISBNDB_API_KEY;
		} else {
			process.env.ISBNDB_API_KEY = originalApiKey;
		}
	});

	test('maps an ISBN lookup response to a metadata candidate', async () => {
		process.env.ISBNDB_API_KEY = 'test-key';

		globalThis.fetch = async (
			input: RequestInfo | URL,
			init?: RequestInit
		): Promise<Response> => {
			assert.equal(String(input), 'https://api.isbndb.com/book/9780441172719');
			const headers = init?.headers as Record<string, string>;
			assert.equal(headers['x-api-key'], 'test-key');

			return jsonResponse({
				book: {
					authors: ['Frank Herbert'],
					date_published: '1965-08-01T00:00:00.000Z',
					image: 'https://images.isbndb.com/covers/dune.jpg',
					isbn: '0441172717',
					isbn13: '9780441172719',
					language: 'en',
					overview: 'A desert planet and a very complicated inheritance.',
					pages: 688,
					publisher: 'Ace',
					subjects: ['Science Fiction'],
					title: 'Dune',
					title_long: 'Dune: Deluxe Edition'
				}
			});
		};

		const provider = new IsbnDbMetadataProvider();
		const result = await provider.lookup({
			isbn: '9780441172719',
			title: 'Dune',
			author: 'Frank Herbert',
			language: 'en'
		});

		assert.equal(result.ok, true);
		if (!result.ok) return;

		assert.equal(result.value.length, 1);
		const candidate = result.value[0];
		assert.equal(candidate?.providerId, 'isbndb');
		assert.equal(candidate?.title, 'Dune: Deluxe Edition');
		assert.deepEqual(candidate?.authors, ['Frank Herbert']);
		assert.equal(candidate?.identifiers.isbn10, '0441172717');
		assert.equal(candidate?.identifiers.isbn13, '9780441172719');
		assert.equal(candidate?.description, 'A desert planet and a very complicated inheritance.');
		assert.equal(candidate?.descriptionFormat, 'text');
		assert.equal(candidate?.publisher, 'Ace');
		assert.equal(candidate?.publishedDate.year, 1965);
		assert.equal(candidate?.pageCount, 688);
		assert.equal(candidate?.language, 'en');
		assert.deepEqual(candidate?.subjects, ['Science Fiction']);
		assert.deepEqual(candidate?.covers, [
			{ url: 'https://images.isbndb.com/covers/dune.jpg', source: 'isbndb' }
		]);
		assert.equal(candidate?.rating.average, null);
		assert.equal(candidate?.sourceUrl, 'https://isbndb.com/book/9780441172719');
		assert.ok((candidate?.providerScore ?? 0) > 10);
	});

	test('searches by title and author when no ISBN is available', async () => {
		process.env.ISBNDB_API_KEY = 'test-key';

		globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
			const requestUrl = new URL(String(input));
			assert.equal(requestUrl.origin, 'https://api.isbndb.com');
			assert.equal(requestUrl.pathname, '/books/Dune');
			assert.equal(requestUrl.searchParams.get('author'), 'Frank Herbert');
			assert.equal(requestUrl.searchParams.get('page'), '1');
			assert.equal(requestUrl.searchParams.get('pageSize'), '3');

			return jsonResponse({
				books: [
					{
						authors: ['Frank Herbert'],
						cover: 'https://images.isbndb.com/covers/dune-list.jpg',
						isbn: '0441172717',
						isbn13: '9780441172719',
						language: 'en',
						pages: '688',
						publisher: 'Ace',
						synopsys: 'A list-search description.',
						title: 'Dune'
					}
				]
			});
		};

		const provider = new IsbnDbMetadataProvider();
		const result = await provider.lookup({
			title: 'Dune',
			author: 'Frank Herbert',
			language: 'english',
			limit: 3
		});

		assert.equal(result.ok, true);
		if (!result.ok) return;

		assert.equal(result.value.length, 1);
		assert.equal(result.value[0]?.title, 'Dune');
		assert.equal(result.value[0]?.pageCount, 688);
		assert.equal(result.value[0]?.description, 'A list-search description.');
		assert.equal(result.value[0]?.covers[0]?.url, 'https://images.isbndb.com/covers/dune-list.jpg');
	});

	test('skips factory creation when ISBNDB_API_KEY is missing', () => {
		delete process.env.ISBNDB_API_KEY;

		assert.equal(createMetadataProvider('isbndb'), null);

		process.env.ISBNDB_API_KEY = 'test-key';
		assert.ok(createMetadataProvider('isbndb') instanceof IsbnDbMetadataProvider);
	});

	test('treats 404 as an empty result set', async () => {
		process.env.ISBNDB_API_KEY = 'test-key';
		globalThis.fetch = async (): Promise<Response> => new Response('', { status: 404 });

		const provider = new IsbnDbMetadataProvider();
		const result = await provider.lookup({ isbn: '9780000000000' });

		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.deepEqual(result.value, []);
	});

	test('returns an auth error when the API key is rejected', async () => {
		process.env.ISBNDB_API_KEY = 'test-key';
		globalThis.fetch = async (): Promise<Response> => new Response('', { status: 401 });

		const provider = new IsbnDbMetadataProvider();
		const result = await provider.lookup({ isbn: '9780441172719' });

		assert.equal(result.ok, false);
		if (result.ok) {
			throw new Error('Expected rejected key to fail');
		}
		assert.equal(result.error.status, 401);
		assert.equal(result.error.message, 'ISBNdb API key was rejected');
	});
});
