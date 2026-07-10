import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { GoogleBooksMetadataProvider } from '$lib/server/infrastructure/metadata-providers/googleBooksMetadataProvider';
import { HardcoverMetadataProvider } from '$lib/server/infrastructure/metadata-providers/hardcoverMetadataProvider';
import { IsbnDbMetadataProvider } from '$lib/server/infrastructure/metadata-providers/isbndbMetadataProvider';
import { OpenLibraryMetadataProvider } from '$lib/server/infrastructure/metadata-providers/openLibraryMetadataProvider';
import {
	createMetadataProvider,
	createMetadataProviders
} from '$lib/server/infrastructure/metadata-providers/metadataProviderFactory';

describe('metadataProviderFactory', () => {
	const originalHardcoverToken = process.env.HARDCOVER_API_TOKEN;
	const originalIsbnDbKey = process.env.ISBNDB_API_KEY;

	afterEach(() => {
		if (originalHardcoverToken === undefined) {
			delete process.env.HARDCOVER_API_TOKEN;
		} else {
			process.env.HARDCOVER_API_TOKEN = originalHardcoverToken;
		}

		if (originalIsbnDbKey === undefined) {
			delete process.env.ISBNDB_API_KEY;
		} else {
			process.env.ISBNDB_API_KEY = originalIsbnDbKey;
		}
	});

	test('creates providers that do not require credentials', () => {
		assert.ok(createMetadataProvider('googlebooks') instanceof GoogleBooksMetadataProvider);
		assert.ok(createMetadataProvider('openlibrary') instanceof OpenLibraryMetadataProvider);
	});

	test('skips Hardcover creation when the token is missing or blank', () => {
		delete process.env.HARDCOVER_API_TOKEN;
		assert.equal(createMetadataProvider('hardcover'), null);

		process.env.HARDCOVER_API_TOKEN = '   ';
		assert.equal(createMetadataProvider('hardcover'), null);

		process.env.HARDCOVER_API_TOKEN = 'test-token';
		assert.ok(createMetadataProvider('hardcover') instanceof HardcoverMetadataProvider);
	});

	test('skips ISBNdb creation when the API key is missing or blank', () => {
		delete process.env.ISBNDB_API_KEY;
		assert.equal(createMetadataProvider('isbndb'), null);

		process.env.ISBNDB_API_KEY = '   ';
		assert.equal(createMetadataProvider('isbndb'), null);

		process.env.ISBNDB_API_KEY = 'test-key';
		assert.ok(createMetadataProvider('isbndb') instanceof IsbnDbMetadataProvider);
	});

	test('filters out providers that cannot be created from the activated list', () => {
		delete process.env.HARDCOVER_API_TOKEN;
		process.env.ISBNDB_API_KEY = 'test-key';

		const providers = createMetadataProviders([
			'googlebooks',
			'hardcover',
			'openlibrary',
			'isbndb'
		]);

		assert.deepEqual(
			providers.map((provider) => provider.id),
			['googlebooks', 'openlibrary', 'isbndb']
		);
	});
});
