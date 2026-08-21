import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	buildZLibraryUrl,
	DEFAULT_ZLIBRARY_BASE_URL,
	MAX_ZLIBRARY_MIRROR_URL_LENGTH,
	normalizeZLibraryMirrorUrls,
	normalizeZLibraryUrl,
	resolveZLibraryBaseUrl,
	resolveZLibraryMirrorUrls
} from '$lib/server/config/zlibrary';

describe('resolveZLibraryBaseUrl', () => {
	test('uses the verified default when unset', () => {
		assert.equal(DEFAULT_ZLIBRARY_BASE_URL, 'https://z-lib.gl');
		assert.equal(resolveZLibraryBaseUrl(undefined), DEFAULT_ZLIBRARY_BASE_URL);
	});

	test('normalizes a configured HTTPS URL', () => {
		assert.equal(resolveZLibraryBaseUrl(' https://z.example/ '), 'https://z.example');
	});

	test('keeps configured mirrors in order and removes duplicates', () => {
		assert.deepEqual(resolveZLibraryMirrorUrls('https://first.example/, https://second.example, https://first.example'), [
			'https://first.example',
			'https://second.example'
		]);
	});

	test('rejects a non-HTTPS URL', () => {
		assert.throws(
			() => resolveZLibraryBaseUrl('file:///tmp/zlibrary'),
			/Z-Library mirror URLs must be absolute HTTPS URLs/
		);
	});

	test('rejects HTTP mirrors and URL components that would corrupt endpoints', () => {
		for (const value of [
			'http://z.example',
			'https://z.example?token=secret',
			'https://z.example/#fragment',
			'https://user:password@z.example'
		]) {
			assert.throws(() => normalizeZLibraryUrl(value));
		}
	});

	test('preserves mirror path prefixes when building endpoints', () => {
		assert.equal(
			buildZLibraryUrl('https://z.example/zlib', '/eapi/book/search'),
			'https://z.example/zlib/eapi/book/search'
		);
	});

	test('bounds mirror count and URL length', () => {
		assert.throws(() =>
			normalizeZLibraryMirrorUrls([
				'https://one.example',
				'https://two.example',
				'https://three.example',
				'https://four.example',
				'https://five.example',
				'https://six.example'
			])
		);
		assert.throws(() => normalizeZLibraryUrl(`https://z.example/${'a'.repeat(MAX_ZLIBRARY_MIRROR_URL_LENGTH)}`));
	});
});
