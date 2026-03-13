import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	isSearchFeatureApiPath,
	parseActivatedSearchProviders
} from '$lib/server/config/activatedProviders.shared';

describe('activatedProviders', () => {
	test('defaults to no providers when env is unset', () => {
		assert.deepEqual(parseActivatedSearchProviders(undefined), []);
	});

	test('supports aliases and removes duplicates', () => {
		assert.deepEqual(
			parseActivatedSearchProviders('zlib, gutenberg, openlib, zlibrary, invalid'),
			['zlibrary', 'gutenberg', 'openlibrary']
		);
	});

	test('returns no providers when configured value contains no valid providers', () => {
		assert.deepEqual(parseActivatedSearchProviders(' , invalid '), []);
	});

	test('matches only search feature api routes', () => {
		assert.equal(isSearchFeatureApiPath('/api/search'), true);
		assert.equal(isSearchFeatureApiPath('/api/search/download'), true);
		assert.equal(isSearchFeatureApiPath('/api/zlibrary/search'), true);
		assert.equal(isSearchFeatureApiPath('/api/zlibrary/search/metadata'), true);
		assert.equal(isSearchFeatureApiPath('/api/zlibrary/download'), false);
		assert.equal(isSearchFeatureApiPath('/api/library/list'), false);
	});
});
