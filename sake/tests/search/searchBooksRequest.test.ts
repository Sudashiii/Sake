import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseSearchBooksRequest } from '$lib/server/http/searchBooksRequest';

describe('parseSearchBooksRequest', () => {
	test('leaves providers undefined when omitted', () => {
		assert.deepEqual(parseSearchBooksRequest({ query: 'Dune' }), {
			query: 'Dune',
			filters: undefined,
			sort: undefined
		});
	});

	test('parses explicit providers when supplied', () => {
		assert.deepEqual(
			parseSearchBooksRequest({
				query: 'Dune',
				providers: ['openlibrary', 'gutenberg'],
				sort: 'relevance'
			}),
			{
				query: 'Dune',
				providers: ['openlibrary', 'gutenberg'],
				filters: undefined,
				sort: 'relevance'
			}
		);
	});

	test('rejects unknown providers', () => {
		assert.throws(
			() => parseSearchBooksRequest({ query: 'Dune', providers: ['invalid'] }),
			/Unknown providers: invalid/
		);
	});
});
