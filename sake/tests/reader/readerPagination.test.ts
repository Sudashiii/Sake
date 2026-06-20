import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	bookPageFromPagination,
	type ReaderPagination
} from '$lib/features/reader/readerPagination';

const pagination: ReaderPagination = {
	sectionPageOffsets: [0, 6, 18],
	totalPages: 30
};

describe('reader pagination', () => {
	test('maps a chapter page into the whole-book page count', () => {
		assert.equal(bookPageFromPagination(pagination, 0, 1), 1);
		assert.equal(bookPageFromPagination(pagination, 1, 1), 7);
		assert.equal(bookPageFromPagination(pagination, 2, 4), 22);
	});

	test('clamps the final page and rejects unavailable positions', () => {
		assert.equal(bookPageFromPagination(pagination, 2, 99), 30);
		assert.equal(bookPageFromPagination(pagination, 3, 1), null);
		assert.equal(bookPageFromPagination(pagination, 1, 0), null);
	});
});
