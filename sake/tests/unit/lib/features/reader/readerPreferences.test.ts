import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	loadReaderNavigationPreferences,
	saveReaderNavigationPreferences
} from '$lib/features/reader/readerPreferences';

class MemoryStorage {
	private readonly values = new Map<string, string>();

	getItem(key: string): string | null {
		return this.values.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.values.set(key, value);
	}
}

describe('reader navigation preferences', () => {
	test('enables tap navigation and shows arrow controls by default', () => {
		const preferences = loadReaderNavigationPreferences(new MemoryStorage());

		assert.deepEqual(preferences, {
			isTapNavigationEnabled: true,
			arePageControlsHidden: false,
			isTapNavigationDebugEnabled: false,
			tapNavigationDelayMs: 200
		});
	});

	test('round-trips both navigation preferences', () => {
		const storage = new MemoryStorage();
		saveReaderNavigationPreferences(storage, {
			isTapNavigationEnabled: false,
			arePageControlsHidden: true,
			isTapNavigationDebugEnabled: true,
			tapNavigationDelayMs: 0
		});

		assert.deepEqual(loadReaderNavigationPreferences(storage), {
			isTapNavigationEnabled: false,
			arePageControlsHidden: true,
			isTapNavigationDebugEnabled: true,
			tapNavigationDelayMs: 0
		});
	});

	test('clamps malformed and excessive stored delays', () => {
		const storage = new MemoryStorage();
		storage.setItem('readerTapNavigationDelayMs', '900');
		assert.equal(loadReaderNavigationPreferences(storage).tapNavigationDelayMs, 500);

		storage.setItem('readerTapNavigationDelayMs', 'not-a-number');
		assert.equal(loadReaderNavigationPreferences(storage).tapNavigationDelayMs, 200);
	});
});
