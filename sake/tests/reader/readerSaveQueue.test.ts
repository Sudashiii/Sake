import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { SidecarSnapshot } from '$lib/features/reader/koreaderSidecar';
import { ReaderSaveQueue } from '$lib/features/reader/readerSaveQueue';

const snapshot: SidecarSnapshot = {
	source: 'return {}',
	percentFinished: 0.4,
	lastXPointer: null,
	annotations: []
};

describe('ReaderSaveQueue', () => {
	test('attempts a pending save during teardown even without an XPointer', async () => {
		const calls: Array<{ percentFinished: number; lastXPointer?: string }> = [];
		const queue = new ReaderSaveQueue(
			'Example.epub',
			'48d2f83f-7568-4f58-8c48-1e773c0d7b58',
			() => ({ percentFinished: 0.4, lastXPointer: null }),
			() => undefined,
			() => undefined,
			async (_fileName, changes) => {
				calls.push({
					percentFinished: changes.percentFinished,
					lastXPointer: changes.lastXPointer
				});
				return snapshot;
			}
		);

		queue.schedule(60_000);
		queue.destroy();
		await new Promise((resolve) => setTimeout(resolve, 0));

		assert.deepEqual(calls, [{ percentFinished: 0.4, lastXPointer: undefined }]);
	});
});
