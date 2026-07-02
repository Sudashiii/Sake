import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	startReaderWakeLock,
	type ReaderVisibilitySource,
	type ReaderWakeLockSentinel,
	type ReaderWakeLockSource
} from '$lib/features/reader/readerWakeLock';

class FakeSentinel implements ReaderWakeLockSentinel {
	released = false;
	releaseCalls = 0;

	async release(): Promise<void> {
		this.releaseCalls += 1;
		this.released = true;
	}
}

class FakeVisibility implements ReaderVisibilitySource {
	visibilityState: DocumentVisibilityState;
	private readonly listeners = new Set<EventListener>();

	constructor(visibilityState: DocumentVisibilityState) {
		this.visibilityState = visibilityState;
	}

	addEventListener(_type: 'visibilitychange', listener: EventListener): void {
		this.listeners.add(listener);
	}

	removeEventListener(_type: 'visibilitychange', listener: EventListener): void {
		this.listeners.delete(listener);
	}

	setVisibility(visibilityState: DocumentVisibilityState): void {
		this.visibilityState = visibilityState;
		for (const listener of this.listeners) {
			listener({ type: 'visibilitychange' } as Event);
		}
	}

	get listenerCount(): number {
		return this.listeners.size;
	}
}

function deferred<T>(): {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (reason?: unknown) => void;
} {
	let resolvePromise!: (value: T) => void;
	let rejectPromise!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolve, reject) => {
		resolvePromise = resolve;
		rejectPromise = reject;
	});
	return { promise, resolve: resolvePromise, reject: rejectPromise };
}

async function settle(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}

describe('reader wake lock', () => {
	test('acquires while visible and releases on teardown', async () => {
		const visibility = new FakeVisibility('visible');
		const sentinel = new FakeSentinel();
		const requestedTypes: string[] = [];
		const wakeLock: ReaderWakeLockSource = {
			async request(type) {
				requestedTypes.push(type);
				return sentinel;
			}
		};

		const stop = startReaderWakeLock(wakeLock, visibility);
		await settle();

		assert.deepEqual(requestedTypes, ['screen']);
		assert.equal(visibility.listenerCount, 1);
		stop();
		await settle();
		assert.equal(sentinel.releaseCalls, 1);
		assert.equal(visibility.listenerCount, 0);
	});

	test('waits for a hidden reader to become visible', async () => {
		const visibility = new FakeVisibility('hidden');
		const sentinel = new FakeSentinel();
		let requestCalls = 0;
		const wakeLock: ReaderWakeLockSource = {
			async request() {
				requestCalls += 1;
				return sentinel;
			}
		};

		const stop = startReaderWakeLock(wakeLock, visibility);
		await settle();
		assert.equal(requestCalls, 0);

		visibility.setVisibility('visible');
		await settle();
		assert.equal(requestCalls, 1);
		stop();
	});

	test('reacquires a browser-released lock after returning to the reader', async () => {
		const visibility = new FakeVisibility('visible');
		const sentinels = [new FakeSentinel(), new FakeSentinel()];
		let requestCalls = 0;
		const wakeLock: ReaderWakeLockSource = {
			async request() {
				return sentinels[requestCalls++];
			}
		};

		const stop = startReaderWakeLock(wakeLock, visibility);
		await settle();
		visibility.setVisibility('hidden');
		sentinels[0].released = true;
		visibility.setVisibility('visible');
		await settle();

		assert.equal(requestCalls, 2);
		stop();
		await settle();
		assert.equal(sentinels[1].releaseCalls, 1);
	});

	test('does not duplicate an in-flight request', async () => {
		const visibility = new FakeVisibility('visible');
		const pendingSentinel = deferred<ReaderWakeLockSentinel>();
		let requestCalls = 0;
		const wakeLock: ReaderWakeLockSource = {
			request() {
				requestCalls += 1;
				return pendingSentinel.promise;
			}
		};

		const stop = startReaderWakeLock(wakeLock, visibility);
		visibility.setVisibility('visible');
		visibility.setVisibility('visible');
		assert.equal(requestCalls, 1);

		pendingSentinel.resolve(new FakeSentinel());
		await settle();
		stop();
	});

	test('silently ignores unsupported and rejected wake locks', async () => {
		const visibility = new FakeVisibility('visible');
		const stopUnsupported = startReaderWakeLock(undefined, visibility);
		assert.equal(visibility.listenerCount, 0);
		stopUnsupported();

		const wakeLock: ReaderWakeLockSource = {
			async request() {
				throw new Error('Not allowed');
			}
		};
		const stopRejected = startReaderWakeLock(wakeLock, visibility);
		await settle();
		stopRejected();
		assert.equal(visibility.listenerCount, 0);
	});

	test('releases a lock that resolves after teardown', async () => {
		const visibility = new FakeVisibility('visible');
		const pendingSentinel = deferred<ReaderWakeLockSentinel>();
		const wakeLock: ReaderWakeLockSource = {
			request() {
				return pendingSentinel.promise;
			}
		};
		const sentinel = new FakeSentinel();

		const stop = startReaderWakeLock(wakeLock, visibility);
		stop();
		pendingSentinel.resolve(sentinel);
		await settle();

		assert.equal(sentinel.releaseCalls, 1);
		assert.equal(visibility.listenerCount, 0);
	});
});
