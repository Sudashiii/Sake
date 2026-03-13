const UMLAUT_REPLACEMENTS: Array<[RegExp, string]> = [
	[/Ä/g, 'Ae'],
	[/Ö/g, 'Oe'],
	[/Ü/g, 'Ue'],
	[/ä/g, 'ae'],
	[/ö/g, 'oe'],
	[/ü/g, 'ue'],
	[/ß/g, 'ss']
];

function transliterate(value: string): string {
	let result = value;
	for (const [pattern, replacement] of UMLAUT_REPLACEMENTS) {
		result = result.replace(pattern, replacement);
	}

	result = result.replace(/&/g, ' and ');
	result = result.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
	return result;
}

function normalizeSegment(value: string, fallback: string): string {
	const ascii = transliterate(value)
		.replace(/[^A-Za-z0-9._-]+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '');

	return ascii.length > 0 ? ascii : fallback;
}

export function sanitizeLibraryStorageKey(rawKey: string, fallback = 'download.bin'): string {
	const input = String(rawKey ?? '').trim();
	if (!input) {
		return fallback;
	}

	const slashNormalized = input.replace(/[\\/]+/g, '_');
	const lastDot = slashNormalized.lastIndexOf('.');
	if (lastDot <= 0 || lastDot === slashNormalized.length - 1) {
		return normalizeSegment(slashNormalized, fallback);
	}

	const name = slashNormalized.slice(0, lastDot);
	const ext = slashNormalized.slice(lastDot + 1);
	const normalizedName = normalizeSegment(name, 'download');
	const normalizedExt = normalizeSegment(ext, 'bin').replace(/\./g, '_');
	return `${normalizedName}.${normalizedExt}`;
}

export function buildSanitizedBookFileName(title: string, bookId: string, extension: string): string {
	const safeTitle = normalizeSegment(title, 'book');
	const safeBookId = normalizeSegment(bookId, 'id');
	const safeExt = normalizeSegment(extension, 'bin').replace(/\./g, '_');
	return `${safeTitle}_${safeBookId}.${safeExt}`;
}
