import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
// @ts-expect-error Bun's test-only mock API is available at runtime but excluded from the app tsconfig.
import { mock } from 'bun:test';

describe('activatedMetadataProviders', () => {
	test('defaults to no providers when env is unset', async () => {
		mock.module('$env/dynamic/private', () => ({ env: {} }));
		const { parseActivatedMetadataProviders } = await import(
			'$lib/server/config/activatedMetadataProviders'
		);

		assert.deepEqual(parseActivatedMetadataProviders(undefined), []);
		assert.deepEqual(parseActivatedMetadataProviders(null), []);
	});

	test('supports aliases and removes duplicates while preserving order', async () => {
		mock.module('$env/dynamic/private', () => ({ env: {} }));
		const { parseActivatedMetadataProviders } = await import(
			'$lib/server/config/activatedMetadataProviders'
		);

		assert.deepEqual(
			parseActivatedMetadataProviders(
				'google, openlib, hardcover, googlebooks, invalid, isbn, open-library'
			),
			['googlebooks', 'openlibrary', 'hardcover', 'isbndb']
		);
	});

	test('returns no providers when configured value contains no valid providers', async () => {
		mock.module('$env/dynamic/private', () => ({ env: {} }));
		const { parseActivatedMetadataProviders } = await import(
			'$lib/server/config/activatedMetadataProviders'
		);

		assert.deepEqual(parseActivatedMetadataProviders(' , invalid '), []);
	});

	test('reports metadata lookup enabled state from activated providers env', async () => {
		mock.module('$env/dynamic/private', () => ({
			env: {
				ACTIVATED_METADATA_PROVIDERS: 'openlib'
			}
		}));

		const { isMetadataLookupEnabled } = await import(
			'$lib/server/config/activatedMetadataProviders'
		);

		assert.equal(isMetadataLookupEnabled(), true);
	});
});
