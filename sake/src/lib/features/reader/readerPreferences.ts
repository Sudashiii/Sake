export interface ReaderNavigationPreferences {
	isTapNavigationEnabled: boolean;
	arePageControlsHidden: boolean;
	isTapNavigationDebugEnabled: boolean;
	tapNavigationDelayMs: number;
}

interface PreferenceStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

const TAP_NAVIGATION_KEY = 'readerTapNavigationEnabled';
const PAGE_CONTROLS_HIDDEN_KEY = 'readerPageControlsHidden';
const TAP_NAVIGATION_DEBUG_KEY = 'readerTapNavigationDebugEnabled';
const TAP_NAVIGATION_DELAY_KEY = 'readerTapNavigationDelayMs';

export const DEFAULT_TAP_NAVIGATION_DELAY_MS = 200;
export const MAX_TAP_NAVIGATION_DELAY_MS = 500;

function storedBoolean(value: string | null, fallback: boolean): boolean {
	if (value === 'true') return true;
	if (value === 'false') return false;
	return fallback;
}

function storedDelay(value: string | null): number {
	const parsed = Number.parseInt(value ?? '', 10);
	if (!Number.isFinite(parsed)) return DEFAULT_TAP_NAVIGATION_DELAY_MS;
	return Math.max(0, Math.min(MAX_TAP_NAVIGATION_DELAY_MS, parsed));
}

export function loadReaderNavigationPreferences(
	storage: PreferenceStorage
): ReaderNavigationPreferences {
	return {
		isTapNavigationEnabled: storedBoolean(storage.getItem(TAP_NAVIGATION_KEY), true),
		arePageControlsHidden: storedBoolean(storage.getItem(PAGE_CONTROLS_HIDDEN_KEY), false),
		isTapNavigationDebugEnabled: storedBoolean(
			storage.getItem(TAP_NAVIGATION_DEBUG_KEY),
			false
		),
		tapNavigationDelayMs: storedDelay(storage.getItem(TAP_NAVIGATION_DELAY_KEY))
	};
}

export function saveReaderNavigationPreferences(
	storage: PreferenceStorage,
	preferences: ReaderNavigationPreferences
): void {
	storage.setItem(TAP_NAVIGATION_KEY, String(preferences.isTapNavigationEnabled));
	storage.setItem(PAGE_CONTROLS_HIDDEN_KEY, String(preferences.arePageControlsHidden));
	storage.setItem(
		TAP_NAVIGATION_DEBUG_KEY,
		String(preferences.isTapNavigationDebugEnabled)
	);
	storage.setItem(TAP_NAVIGATION_DELAY_KEY, String(preferences.tapNavigationDelayMs));
}
