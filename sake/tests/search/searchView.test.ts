import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	getActiveProviderOptions,
	getDefaultSelectedProviders,
	normalizeProviderSelection
} from '$lib/features/search/searchView';

describe('searchView provider activation helpers', () => {
	test('defaults to zlibrary when active', () => {
		assert.deepEqual(getDefaultSelectedProviders(['zlibrary', 'gutenberg']), ['zlibrary']);
	});

	test('falls back to first active provider when zlibrary is disabled', () => {
		assert.deepEqual(getDefaultSelectedProviders(['gutenberg', 'openlibrary']), ['gutenberg']);
	});

	test('clamps provider selections to active providers', () => {
		assert.deepEqual(
			normalizeProviderSelection(['zlibrary', 'openlibrary'], ['gutenberg', 'openlibrary']),
			['openlibrary']
		);
		assert.deepEqual(normalizeProviderSelection(['zlibrary'], ['gutenberg']), ['gutenberg']);
	});

	test('filters provider options to active providers only', () => {
		assert.deepEqual(
			getActiveProviderOptions(['gutenberg', 'openlibrary']).map((option) => option.value),
			['openlibrary', 'gutenberg']
		);
	});
});
