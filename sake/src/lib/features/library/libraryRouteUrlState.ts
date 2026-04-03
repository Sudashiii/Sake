export function parseOpenBookIdFromSearch(search: string): number | null {
	const params = new URLSearchParams(search);
	const raw = params.get('openBookId');
	if (!raw) {
		return null;
	}

	const parsed = Number.parseInt(raw, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

export function replaceCurrentQueryParam(
	key: string,
	value: string | number | null | undefined
): void {
	if (typeof window === 'undefined') {
		return;
	}

	const params = new URLSearchParams(window.location.search);
	if (value === null || value === undefined || value === '') {
		params.delete(key);
	} else {
		params.set(key, String(value));
	}

	const query = params.toString();
	const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
	window.history.replaceState(window.history.state, '', nextUrl);
}

export function replaceCurrentOpenBookId(openBookId?: number | null): void {
	replaceCurrentQueryParam('openBookId', openBookId);
}
