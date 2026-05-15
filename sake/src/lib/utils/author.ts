export function normalizeAuthor(raw: string | null | undefined): string | null {
	if (typeof raw !== 'string') {
		return null;
	}

	const normalized = raw.replace(/\s+/g, ' ').trim();
	return normalized.length > 0 ? normalized : null;
}

export function normalizeAuthorForMatch(raw: string | null | undefined): string {
	return normalizeAuthor(raw)?.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() ?? '';
}
