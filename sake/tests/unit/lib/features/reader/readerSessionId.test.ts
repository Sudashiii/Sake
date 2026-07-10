import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createReaderSessionId } from '$lib/features/reader/readerSessionId';

describe('reader session IDs', () => {
	test('uses randomUUID when the runtime provides it', () => {
		const id = createReaderSessionId({
			randomUUID: () => '48d2f83f-7568-4f58-8c48-1e773c0d7b58'
		});

		assert.equal(id, '48d2f83f-7568-4f58-8c48-1e773c0d7b58');
	});

	test('creates a valid UUIDv4 without randomUUID', () => {
		const id = createReaderSessionId({
			getRandomValues: (values) => {
				values.fill(0x11);
				return values;
			}
		});

		assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	});
});
