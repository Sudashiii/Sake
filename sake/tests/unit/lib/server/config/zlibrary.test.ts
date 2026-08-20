import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DEFAULT_ZLIBRARY_BASE_URL, resolveZLibraryBaseUrl } from '$lib/server/config/zlibrary';

describe('resolveZLibraryBaseUrl', () => {
	test('uses the backwards-compatible default when unset', () => {
		assert.equal(resolveZLibraryBaseUrl(undefined), DEFAULT_ZLIBRARY_BASE_URL);
	});

	test('normalizes a configured HTTP(S) URL', () => {
		assert.equal(resolveZLibraryBaseUrl(' https://z.example/ '), 'https://z.example');
	});

	test('rejects a non-HTTP(S) URL', () => {
		assert.throws(
			() => resolveZLibraryBaseUrl('file:///tmp/zlibrary'),
			/ZLIBRARY_BASE_URL must be an absolute HTTP\(S\) URL/
		);
	});
});
