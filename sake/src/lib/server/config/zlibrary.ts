export const DEFAULT_ZLIBRARY_BASE_URL = 'https://z-lib.gl';

export function resolveZLibraryBaseUrl(rawValue: string | undefined | null): string {
	const value = rawValue?.trim();
	if (!value) {
		return DEFAULT_ZLIBRARY_BASE_URL;
	}

	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error('ZLIBRARY_BASE_URL must be an absolute HTTP(S) URL');
	}

	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error('ZLIBRARY_BASE_URL must be an absolute HTTP(S) URL');
	}

	return url.toString().replace(/\/$/, '');
}
