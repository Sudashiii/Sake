export function extractIsbn(identifier: string | null | undefined): string | null {
	if (!identifier) {
		return null;
	}

	const matches = identifier.match(/(?:97[89][-\s]?(?:\d[-\s]?){10}|(?:\d[-\s]?){9}[\dXx])/g);
	if (!matches) {
		return null;
	}

	for (const match of matches) {
		const normalized = match.replace(/[^0-9Xx]/g, '').toUpperCase();
		if (normalized.length === 13 || normalized.length === 10) {
			return normalized;
		}
	}

	return null;
}
