export interface RsvpPreferences {
	wpm: number;
	textScale: number;
	showGuideLine: boolean;
	autoAnnotateLastWord: boolean;
}

interface PreferenceStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

export const DEFAULT_RSVP_WPM = 300;
export const MIN_RSVP_WPM = 100;
export const MAX_RSVP_WPM = 1000;
export const RSVP_WPM_STEP = 25;
export const DEFAULT_RSVP_TEXT_SCALE = 140;
export const MIN_RSVP_TEXT_SCALE = 90;
export const MAX_RSVP_TEXT_SCALE = 220;
export const RSVP_TEXT_SCALE_STEP = 10;
export const DEFAULT_RSVP_SHOW_GUIDE_LINE = true;
export const DEFAULT_RSVP_AUTO_ANNOTATE_LAST_WORD = false;

const RSVP_WPM_KEY = 'readerRsvpWpm';
const RSVP_TEXT_SCALE_KEY = 'readerRsvpTextScale';
const RSVP_SHOW_GUIDE_LINE_KEY = 'readerRsvpShowGuideLine';
const RSVP_AUTO_ANNOTATE_LAST_WORD_KEY = 'readerRsvpAutoAnnotateLastWord';

export function clampRsvpWpm(value: number): number {
	if (!Number.isFinite(value)) return DEFAULT_RSVP_WPM;
	const clamped = Math.max(MIN_RSVP_WPM, Math.min(MAX_RSVP_WPM, Math.round(value)));
	return Math.round(clamped / RSVP_WPM_STEP) * RSVP_WPM_STEP;
}

export function clampRsvpTextScale(value: number): number {
	if (!Number.isFinite(value)) return DEFAULT_RSVP_TEXT_SCALE;
	const clamped = Math.max(MIN_RSVP_TEXT_SCALE, Math.min(MAX_RSVP_TEXT_SCALE, Math.round(value)));
	return Math.round(clamped / RSVP_TEXT_SCALE_STEP) * RSVP_TEXT_SCALE_STEP;
}

function parseBoolean(value: string | null, fallback: boolean): boolean {
	if (value === 'true') return true;
	if (value === 'false') return false;
	return fallback;
}

export function loadRsvpPreferences(storage: PreferenceStorage): RsvpPreferences {
	const wpm = Number.parseInt(storage.getItem(RSVP_WPM_KEY) ?? '', 10);
	const textScale = Number.parseInt(storage.getItem(RSVP_TEXT_SCALE_KEY) ?? '', 10);
	return {
		wpm: clampRsvpWpm(wpm),
		textScale: clampRsvpTextScale(textScale),
		showGuideLine: parseBoolean(
			storage.getItem(RSVP_SHOW_GUIDE_LINE_KEY),
			DEFAULT_RSVP_SHOW_GUIDE_LINE
		),
		autoAnnotateLastWord: parseBoolean(
			storage.getItem(RSVP_AUTO_ANNOTATE_LAST_WORD_KEY),
			DEFAULT_RSVP_AUTO_ANNOTATE_LAST_WORD
		)
	};
}

export function saveRsvpPreferences(storage: PreferenceStorage, preferences: RsvpPreferences): void {
	storage.setItem(RSVP_WPM_KEY, String(clampRsvpWpm(preferences.wpm)));
	storage.setItem(RSVP_TEXT_SCALE_KEY, String(clampRsvpTextScale(preferences.textScale)));
	storage.setItem(RSVP_SHOW_GUIDE_LINE_KEY, String(preferences.showGuideLine));
	storage.setItem(RSVP_AUTO_ANNOTATE_LAST_WORD_KEY, String(preferences.autoAnnotateLastWord));
}
