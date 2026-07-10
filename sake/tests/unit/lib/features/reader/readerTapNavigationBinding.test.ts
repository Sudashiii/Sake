import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readerRelativeX } from '$lib/features/reader/readerTapNavigationBinding';

describe('reader tap navigation frame coordinates', () => {
	test('converts an iframe-local click into reader-wide coordinates', () => {
		assert.equal(readerRelativeX(40, 640, 100), 580);
	});

	test('preserves coordinates when the frame starts at the reader edge', () => {
		assert.equal(readerRelativeX(140, 100, 100), 140);
	});
});
