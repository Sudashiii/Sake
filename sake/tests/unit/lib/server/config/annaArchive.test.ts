import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	DEFAULT_ANNA_ARCHIVE_BASE_URL,
	MAX_ANNA_ARCHIVE_MIRRORS,
	normalizeAnnaArchiveMirrorUrls,
	resolveAnnaArchiveMirrorUrls
} from '$lib/server/config/annaArchive';

describe('Anna Archive mirror configuration', () => {
	test('uses the official fallback when no environment value is configured', () => {
		assert.deepEqual(resolveAnnaArchiveMirrorUrls(undefined), [DEFAULT_ANNA_ARCHIVE_BASE_URL]);
		assert.deepEqual(resolveAnnaArchiveMirrorUrls(''), [DEFAULT_ANNA_ARCHIVE_BASE_URL]);
	});

	test('keeps configured mirrors in order and removes duplicates', () => {
		assert.deepEqual(
			resolveAnnaArchiveMirrorUrls(
				'https://first.example/, https://second.example, https://first.example'
			),
			['https://first.example', 'https://second.example']
		);
	});

	test('rejects unsafe or malformed mirror URLs', () => {
		assert.throws(
			() => normalizeAnnaArchiveMirrorUrls(['http://mirror.example']),
			/absolute HTTPS URLs/
		);
		assert.throws(
			() => normalizeAnnaArchiveMirrorUrls(['https://user:pass@mirror.example']),
			/must not include query strings, fragments, or credentials/
		);
		assert.throws(
			() => normalizeAnnaArchiveMirrorUrls(['https://mirror.example/search?q=books']),
			/must not include query strings, fragments, or credentials/
		);
	});

	test('bounds the number of mirrors', () => {
		assert.throws(
			() =>
				normalizeAnnaArchiveMirrorUrls(
					Array.from({ length: MAX_ANNA_ARCHIVE_MIRRORS + 1 }, (_, index) =>
						`https://mirror-${index}.example`
					)
				),
			/At most 5 Anna Archive mirror URLs are allowed/
		);
	});
});
