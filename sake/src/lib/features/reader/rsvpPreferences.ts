export interface RsvpPreferences {
	wpm: number;
}

interface PreferenceStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

export const DEFAULT_RSVP_WPM = 300;
export const MIN_RSVP_WPM = 100;
export const MAX_RSVP_WPM = 1000;
export const RSVP_WPM_STEP = 25;

const RSVP_WPM_KEY = 'readerRsvpWpm';

export function clampRsvpWpm(value: number): number {
	if (!Number.isFinite(value)) return DEFAULT_RSVP_WPM;
	const clamped = Math.max(MIN_RSVP_WPM, Math.min(MAX_RSVP_WPM, Math.round(value)));
	return Math.round(clamped / RSVP_WPM_STEP) * RSVP_WPM_STEP;
}

export function loadRsvpPreferences(storage: PreferenceStorage): RsvpPreferences {
	const raw = storage.getItem(RSVP_WPM_KEY);
	const parsed = Number.parseInt(raw ?? '', 10);
	return { wpm: clampRsvpWpm(parsed) };
}

export function saveRsvpPreferences(storage: PreferenceStorage, preferences: RsvpPreferences): void {
	storage.setItem(RSVP_WPM_KEY, String(clampRsvpWpm(preferences.wpm)));
}
