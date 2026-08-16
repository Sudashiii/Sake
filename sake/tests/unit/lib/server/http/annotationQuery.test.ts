import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseAnnotationQuery } from '$lib/server/http/annotationQuery';

describe('annotation query parsing', () => {
	test('normalizes supported filters', () => {
		const query = parseAnnotationQuery(new URLSearchParams('q=memory&type=with-note&bookId=2&shelfId=3&color=blue&from=2026-01-01&to=2026-12-31&sort=book&limit=25'));
		assert.deepEqual(query, {
			q: 'memory', type: 'with-note', bookId: 2, shelfId: 3, color: 'blue',
			from: '2026-01-01', to: '2026-12-31', sort: 'book', cursor: null, limit: 25
		});
	});

	test('rejects invalid bounds and filter values', () => {
		assert.throws(() => parseAnnotationQuery(new URLSearchParams('limit=101')), /limit/);
		assert.throws(() => parseAnnotationQuery(new URLSearchParams('type=note')), /type/);
		assert.throws(() => parseAnnotationQuery(new URLSearchParams('from=2026-12-31&to=2026-01-01')), /from/);
		assert.throws(() => parseAnnotationQuery(new URLSearchParams('color=pink')), /color/);
	});
});
