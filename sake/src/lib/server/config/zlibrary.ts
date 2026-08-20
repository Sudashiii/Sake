export const DEFAULT_ZLIBRARY_BASE_URL = 'https://z-lib.gl';

export function resolveZLibraryBaseUrl(rawValue: string | undefined | null): string {
	return resolveZLibraryMirrorUrls(rawValue)[0] ?? DEFAULT_ZLIBRARY_BASE_URL;
}

export function resolveZLibraryMirrorUrls(rawValue: string | undefined | null): string[] {
	const values = rawValue?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
	if (values.length === 0) return [DEFAULT_ZLIBRARY_BASE_URL];
	return [...new Set(values.map(normalizeZLibraryUrl))];
}

export function normalizeZLibraryUrl(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) throw new Error('Z-Library mirror URL is required');

	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		throw new Error('Z-Library mirror URLs must be absolute HTTP(S) URLs');
	}

	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error('Z-Library mirror URLs must be absolute HTTP(S) URLs');
	}

	return url.toString().replace(/\/$/, '');
}
