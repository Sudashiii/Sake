import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	parseZPasswordLoginRequest,
	parseZSearchRequest,
	parseZTokenLoginRequest
} from '$lib/server/http/zlibraryRequests';

describe('Z-Library request parsers', () => {
	test('parses valid token credentials and trims their boundaries', () => {
		assert.deepEqual(parseZTokenLoginRequest({ userId: ' id ', userKey: ' key ' }), {
			userId: 'id',
			userKey: 'key'
		});
	});

	test('rejects null, arrays, missing fields, wrong types, and oversized credentials', () => {
		for (const value of [null, [], { userId: 'id' }, { userId: 'id', userKey: 42 }]) {
			assert.throws(() => parseZTokenLoginRequest(value));
		}
		assert.throws(() => parseZPasswordLoginRequest({ email: 'a@b.test', password: 'x'.repeat(1025) }), /too long/);
	});

	test('parses the legacy search shape without exposing the transport DTO', () => {
		assert.deepEqual(
			parseZSearchRequest({
				searchText: ' Dune ',
				yearFrom: '1965',
				languages: [' en '],
				extensions: ['epub'],
				order: 'desc',
				limit: 20
			}),
			{
				searchText: 'Dune',
				yearFrom: '1965',
				languages: ['en'],
				extensions: ['epub'],
				order: 'desc',
				limit: 20
			}
		);
	});

	test('rejects invalid search filters and limits', () => {
		assert.throws(() => parseZSearchRequest(null), /JSON object/);
		assert.throws(() => parseZSearchRequest([]), /JSON object/);
		assert.throws(() => parseZSearchRequest({ searchText: 'Dune', languages: ['en', 4] }), /strings/);
		assert.throws(() => parseZSearchRequest({ searchText: 'Dune', order: 'popular' }), /order/);
		assert.throws(() => parseZSearchRequest({ searchText: 'Dune', limit: 101 }), /between 1 and 100/);
		assert.throws(() => parseZSearchRequest({ searchText: 'Dune', limit: 1.5 }), /between 1 and 100/);
		assert.throws(() => parseZSearchRequest({ searchText: 'Dune', yearFrom: 1965 }), /year/);
	});
});
