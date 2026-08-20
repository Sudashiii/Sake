import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { SidecarSnapshot } from '$lib/koreader/koreaderSidecar';
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

	test('waits for a checkpoint queued during an in-flight sidecar merge', async () => {
		let releaseFirstSave: (() => void) | undefined;
		let saveCalls = 0;
		const queue = new ReaderSaveQueue(
			'Example.epub',
			'48d2f83f-7568-4f58-8c48-1e773c0d7b58',
			() => ({ percentFinished: 0.6, lastXPointer: '/body/DocFragment/body/p/text().1' }),
			() => undefined,
			() => undefined,
			async () => {
				saveCalls += 1;
				if (saveCalls === 1) {
					await new Promise<void>((resolve) => {
						releaseFirstSave = resolve;
					});
				}
				return snapshot;
			}
		);

		const first = queue.flush();
		await new Promise((resolve) => setTimeout(resolve, 0));
		const second = queue.flush();
		assert.equal(saveCalls, 1);
		releaseFirstSave?.();
		await Promise.all([first, second]);
		assert.equal(saveCalls, 2);
	});
});
