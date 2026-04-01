import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { AnnaArchiveSearchProvider } from '$lib/server/infrastructure/search-providers/AnnaArchiveSearchProvider';
import type { SearchBooksRequest } from '$lib/types/Search/SearchBooksRequest';

function buildSearchHtml(hash: string, title: string, author: string, metadata: string): string {
	return `
		<a href="/md5/${hash}" class="custom-a block mr-2 sm:mr-4 hover:opacity-80">
			<img src="/covers/${hash}.jpg" />
		</a>
		<a href="/md5/${hash}" class="line-clamp-[3] overflow-hidden break-words js-vim-focus custom-a text-[#2563eb] inline-block outline-offset-[-2px] outline-2 rounded-[3px] focus:outline font-semibold text-lg leading-[1.2] hover:opacity-80 mt-1">${title}</a>
		<a href="/search?q=${encodeURIComponent(author)}"><span class="icon-[mdi--user-edit]"></span>${author}</a>
		<div class="text-gray-800">${metadata}</div>
		<a href="/md5/${hash}ffffffffffffffffffffffffffffffff" class="custom-a block mr-2 sm:mr-4 hover:opacity-80"></a>
	`;
}

describe('AnnaArchiveSearchProvider', () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	test('passes supported filters upstream and still matches localized language aliases', async () => {
		globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
			const requestUrl = new URL(String(input));

			assert.equal(requestUrl.origin, 'https://annas-archive.gl');
			assert.equal(requestUrl.pathname, '/search');
			assert.equal(requestUrl.searchParams.get('q'), 'Harry Potter');
			assert.equal(requestUrl.searchParams.get('content'), 'book_any');
			assert.equal(requestUrl.searchParams.get('lang'), 'de');
			assert.equal(requestUrl.searchParams.get('ext'), 'epub');

			return new Response(
				buildSearchHtml(
					'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
					'Harry Potter und der Stein der Weisen',
					'J.K. Rowling',
					'de [de] · EPUB · 2 MB · 1998 · zlib'
				),
				{
					status: 200,
					headers: {
						'content-type': 'text/html'
					}
				}
			);
		};

		const provider = new AnnaArchiveSearchProvider();
		const request: SearchBooksRequest = {
			query: 'Harry Potter',
			filters: {
				language: ['german'],
				extension: ['epub'],
				limitPerProvider: 20
			}
		};

		const result = await provider.search(request, {});

		assert.equal(result.ok, true);
		if (!result.ok) {
			return;
		}

		assert.equal(result.value.length, 1);
		assert.equal(result.value[0]?.title, 'Harry Potter und der Stein der Weisen');
		assert.equal(result.value[0]?.language, 'de');
		assert.equal(result.value[0]?.extension, 'epub');
	});

	test('checks additional pages when the first filtered page has no local matches', async () => {
		const requestedPages: string[] = [];

		globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
			const requestUrl = new URL(String(input));
			requestedPages.push(requestUrl.searchParams.get('page') ?? '1');

			const page = requestUrl.searchParams.get('page') ?? '1';
			const html =
				page === '1'
					? buildSearchHtml(
							'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
							'Harry Potter and the Goblet of Fire',
							'J.K. Rowling',
							'English [en] · EPUB · 2 MB · 2000 · zlib'
						)
					: buildSearchHtml(
							'cccccccccccccccccccccccccccccccc',
							'Harry Potter und der Stein der Weisen',
							'J.K. Rowling',
							'German [de] · English [en] · EPUB · 2 MB · 1998 · zlib'
						);

			return new Response(html, {
				status: 200,
				headers: {
					'content-type': 'text/html'
				}
			});
		};

		const provider = new AnnaArchiveSearchProvider();
		const result = await provider.search(
			{
				query: 'Harry Potter',
				filters: {
					language: ['german'],
					extension: ['epub'],
					limitPerProvider: 20
				}
			},
			{}
		);

		assert.equal(result.ok, true);
		if (!result.ok) {
			return;
		}

		assert.deepEqual(requestedPages, ['1', '2', '3', '4', '5']);
		assert.equal(result.value.length, 1);
		assert.equal(result.value[0]?.title, 'Harry Potter und der Stein der Weisen');
		assert.equal(result.value[0]?.language, 'German');
	});

	test('falls back to a language-augmented query when the native filtered query stays empty', async () => {
		const requestedQueries: string[] = [];

		globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
			const requestUrl = new URL(String(input));
			requestedQueries.push(requestUrl.searchParams.get('q') ?? '');

			const query = requestUrl.searchParams.get('q') ?? '';
			const html = query.toLowerCase().includes('deutsch')
				? buildSearchHtml(
						'dddddddddddddddddddddddddddddddd',
						'Harry Potter und der Feuerkelch',
						'J.K. Rowling',
						'German [de] · EPUB · 2 MB · 2000 · zlib'
					)
				: buildSearchHtml(
						'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
						'Harry Potter and the Goblet of Fire',
						'J.K. Rowling',
						'English [en] · EPUB · 2 MB · 2000 · zlib'
					);

			return new Response(html, {
				status: 200,
				headers: {
					'content-type': 'text/html'
				}
			});
		};

		const provider = new AnnaArchiveSearchProvider();
		const result = await provider.search(
			{
				query: 'Harry Potter',
				filters: {
					language: ['german'],
					extension: ['epub'],
					limitPerProvider: 20
				}
			},
			{}
		);

		assert.equal(result.ok, true);
		if (!result.ok) {
			return;
		}

		assert.equal(result.value.length, 1);
		assert.equal(result.value[0]?.title, 'Harry Potter und der Feuerkelch');
		assert.deepEqual([...new Set(requestedQueries)], ['Harry Potter', 'Harry Potter deutsch']);
	});
});
