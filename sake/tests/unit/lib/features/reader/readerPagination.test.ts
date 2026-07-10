import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { bookPageFromLocation } from '$lib/features/reader/readerPagination';

describe('reader pagination', () => {
	test('maps EPUB locations into one-based whole-book pages', () => {
		assert.equal(bookPageFromLocation(30, 0), 1);
		assert.equal(bookPageFromLocation(30, 6), 7);
		assert.equal(bookPageFromLocation(30, 21), 22);
	});

	test('clamps the final page and rejects unavailable locations', () => {
		assert.equal(bookPageFromLocation(30, 99), 30);
		assert.equal(bookPageFromLocation(0, 0), null);
		assert.equal(bookPageFromLocation(30, -1), null);
		assert.equal(bookPageFromLocation(Number.NaN, 1), null);
	});
});
