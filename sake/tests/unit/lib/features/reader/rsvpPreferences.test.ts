import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	DEFAULT_RSVP_WPM,
	loadRsvpPreferences,
	saveRsvpPreferences,
	clampRsvpWpm
} from '$lib/features/reader/rsvpPreferences';

class MemoryStorage {
	private readonly values = new Map<string, string>();

	getItem(key: string): string | null {
		return this.values.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.values.set(key, value);
	}
}

describe('RSVP preferences', () => {
	test('uses the 300 WPM default and round-trips a stored speed', () => {
		const storage = new MemoryStorage();
		assert.deepEqual(loadRsvpPreferences(storage), { wpm: DEFAULT_RSVP_WPM });
		saveRsvpPreferences(storage, { wpm: 475 });
		assert.deepEqual(loadRsvpPreferences(storage), { wpm: 475 });
	});

	test('clamps and snaps malformed, low, high, and fractional speeds', () => {
		assert.equal(clampRsvpWpm(Number.NaN), 300);
		assert.equal(clampRsvpWpm(20), 100);
		assert.equal(clampRsvpWpm(2000), 1000);
		assert.equal(clampRsvpWpm(312), 300);
		assert.equal(clampRsvpWpm(313), 325);
	});
});
