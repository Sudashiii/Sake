export function parseOpenBookIdFromSearch(search: string): number | null {
	const params = new URLSearchParams(search);
	const raw = params.get('openBookId');
	if (!raw || !/^\d+$/.test(raw)) {
		return null;
	}

	return Number.parseInt(raw, 10);
}

export function replaceCurrentQueryParams(
	updates: Record<string, string | number | null | undefined>
): void {
	if (typeof window === 'undefined') {
		return;
	}

	const params = new URLSearchParams(window.location.search);
	for (const [key, value] of Object.entries(updates)) {
		if (value === null || value === undefined) {
			params.delete(key);
		} else {
			params.set(key, String(value));
		}
	}

	const query = params.toString();
	const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
	window.history.replaceState(window.history.state, '', nextUrl);
}

export function replaceCurrentQueryParam(
	key: string,
	value: string | number | null | undefined
): void {
	replaceCurrentQueryParams({ [key]: value });
}

export function replaceCurrentOpenBookId(openBookId?: number | null): void {
	replaceCurrentQueryParam('openBookId', openBookId);
}
