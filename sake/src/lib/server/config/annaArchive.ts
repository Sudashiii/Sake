export const DEFAULT_ANNA_ARCHIVE_BASE_URL = 'https://annas-archive.gl';
export const MAX_ANNA_ARCHIVE_MIRRORS = 5;
export const MAX_ANNA_ARCHIVE_MIRROR_URL_LENGTH = 2048;
export const ANNA_ARCHIVE_MIRROR_FAILOVER_TIMEOUT_MS = 90_000;
export const ANNA_ARCHIVE_REQUEST_TIMEOUT_MS = 30_000;
export const ANNA_ARCHIVE_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

export function resolveAnnaArchiveMirrorUrls(rawValue: string | undefined | null): string[] {
	const values = rawValue?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
	if (values.length === 0) return [DEFAULT_ANNA_ARCHIVE_BASE_URL];
	return normalizeAnnaArchiveMirrorUrls(values);
}

export function normalizeAnnaArchiveMirrorUrls(values: readonly string[]): string[] {
	if (values.length === 0) {
		throw new Error('At least one Anna Archive mirror URL is required');
	}
	if (values.length > MAX_ANNA_ARCHIVE_MIRRORS) {
		throw new Error(`At most ${MAX_ANNA_ARCHIVE_MIRRORS} Anna Archive mirror URLs are allowed`);
	}

	const normalized = [...new Set(values.map(normalizeAnnaArchiveMirrorUrl))];
	if (normalized.length > MAX_ANNA_ARCHIVE_MIRRORS) {
		throw new Error(`At most ${MAX_ANNA_ARCHIVE_MIRRORS} Anna Archive mirror URLs are allowed`);
	}
	return normalized;
}

export function normalizeAnnaArchiveMirrorUrl(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) throw new Error('Anna Archive mirror URL is required');
	if (trimmed.length > MAX_ANNA_ARCHIVE_MIRROR_URL_LENGTH) {
		throw new Error(
			`Anna Archive mirror URLs must be at most ${MAX_ANNA_ARCHIVE_MIRROR_URL_LENGTH} characters`
		);
	}

	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		throw new Error('Anna Archive mirror URLs must be absolute HTTPS URLs');
	}

	if (url.protocol !== 'https:' || !url.hostname) {
		throw new Error('Anna Archive mirror URLs must be absolute HTTPS URLs');
	}
	if (url.username || url.password || url.search || url.hash) {
		throw new Error(
			'Anna Archive mirror URLs must not include query strings, fragments, or credentials'
		);
	}

	const normalized = url.toString().replace(/\/+$/, '');
	if (normalized.length > MAX_ANNA_ARCHIVE_MIRROR_URL_LENGTH) {
		throw new Error(
			`Anna Archive mirror URLs must be at most ${MAX_ANNA_ARCHIVE_MIRROR_URL_LENGTH} characters`
		);
	}
	return normalized;
}

export function buildAnnaArchiveUrl(baseUrl: string, path: string): string {
	const normalizedBaseUrl = normalizeAnnaArchiveMirrorUrl(baseUrl);
	const baseWithPathSeparator = normalizedBaseUrl.endsWith('/')
		? normalizedBaseUrl
		: `${normalizedBaseUrl}/`;
	return new URL(path.replace(/^\/+/, ''), baseWithPathSeparator).toString();
}
