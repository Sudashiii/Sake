import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseWebProgressRequest } from '$lib/server/http/webReaderProgressRequest';

const BASE_REQUEST = {
	fileName: 'Example.epub',
	readerSessionId: '48d2f83f-7568-4f58-8c48-1e773c0d7b58',
	upsertedAnnotations: [],
	deletedAnnotationIds: []
};

describe('web reader progress request parser', () => {
	test('accepts an exact position update', () => {
		const result = parseWebProgressRequest({
			...BASE_REQUEST,
			percentFinished: 0.5,
			lastXPointer: '/body/DocFragment/body/p/text().4'
		});

		assert.equal(result.ok, true);
	});

	test('accepts annotation-only changes without a position', () => {
		const result = parseWebProgressRequest({
			...BASE_REQUEST,
			upsertedAnnotations: [
				{
					id: 'annotation-1',
					kind: 'bookmark',
					page: '/body/DocFragment/body/p/text().4',
					datetime: '2026-08-31 10:00:00'
				}
			]
		});

		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.equal(result.value.changes.percentFinished, undefined);
	});

	test('rejects an incomplete position update', () => {
		const result = parseWebProgressRequest({
			...BASE_REQUEST,
			percentFinished: 0.5
		});

		assert.equal(result.ok, false);
		if (result.ok) return;
		assert.match(result.message, /provided together/);
	});

	test('rejects malformed annotation fields', () => {
		const result = parseWebProgressRequest({
			...BASE_REQUEST,
			upsertedAnnotations: [
				{
					id: 'annotation-1',
					kind: 'highlight',
					page: '/body/DocFragment/body/p/text().4',
					datetime: '2026-08-31 10:00:00',
					note: 42
				}
			]
		});

		assert.equal(result.ok, false);
		if (result.ok) return;
		assert.match(result.message, /invalid annotation/);
	});
});
