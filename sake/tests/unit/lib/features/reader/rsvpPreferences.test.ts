import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	DEFAULT_RSVP_TEXT_SCALE,
	DEFAULT_RSVP_WPM,
	clampRsvpTextScale,
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
		assert.deepEqual(loadRsvpPreferences(storage), {
			wpm: DEFAULT_RSVP_WPM,
			textScale: DEFAULT_RSVP_TEXT_SCALE
		});
		saveRsvpPreferences(storage, { wpm: 475, textScale: 170 });
		assert.deepEqual(loadRsvpPreferences(storage), { wpm: 475, textScale: 170 });
	});

	test('clamps and snaps malformed, low, high, and fractional speeds', () => {
		assert.equal(clampRsvpWpm(Number.NaN), 300);
		assert.equal(clampRsvpWpm(20), 100);
		assert.equal(clampRsvpWpm(2000), 1000);
		assert.equal(clampRsvpWpm(312), 300);
		assert.equal(clampRsvpWpm(313), 325);
	});

	test('clamps and snaps the configurable RSVP text scale', () => {
		assert.equal(clampRsvpTextScale(Number.NaN), DEFAULT_RSVP_TEXT_SCALE);
		assert.equal(clampRsvpTextScale(20), 90);
		assert.equal(clampRsvpTextScale(500), 220);
		assert.equal(clampRsvpTextScale(134), 130);
		assert.equal(clampRsvpTextScale(135), 140);
	});
});
