import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	DEFAULT_ZLIBRARY_BASE_URL,
	resolveZLibraryBaseUrl,
	resolveZLibraryMirrorUrls
} from '$lib/server/config/zlibrary';

describe('resolveZLibraryBaseUrl', () => {
	test('uses the verified default when unset', () => {
		assert.equal(DEFAULT_ZLIBRARY_BASE_URL, 'https://z-lib.gl');
		assert.equal(resolveZLibraryBaseUrl(undefined), DEFAULT_ZLIBRARY_BASE_URL);
	});

	test('normalizes a configured HTTP(S) URL', () => {
		assert.equal(resolveZLibraryBaseUrl(' https://z.example/ '), 'https://z.example');
	});

	test('keeps configured mirrors in order and removes duplicates', () => {
		assert.deepEqual(resolveZLibraryMirrorUrls('https://first.example/, https://second.example, https://first.example'), [
			'https://first.example',
			'https://second.example'
		]);
	});

	test('rejects a non-HTTP(S) URL', () => {
		assert.throws(
			() => resolveZLibraryBaseUrl('file:///tmp/zlibrary'),
			/Z-Library mirror URLs must be absolute HTTP\(S\) URLs/
		);
	});
});
