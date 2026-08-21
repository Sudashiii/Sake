import type {
	SearchProviderContext,
	SearchProviderDownloadInput,
	SearchProviderDownloadPort,
	SearchProviderPort
} from '$lib/server/application/ports/SearchProviderPort';
import {
	ANNA_ARCHIVE_MAX_RESPONSE_BYTES,
	ANNA_ARCHIVE_MIRROR_FAILOVER_TIMEOUT_MS,
	ANNA_ARCHIVE_REQUEST_TIMEOUT_MS,
	buildAnnaArchiveUrl,
	DEFAULT_ANNA_ARCHIVE_BASE_URL,
	normalizeAnnaArchiveMirrorUrls
} from '$lib/server/config/annaArchive';
import type { ExternalClientErrorKind } from '$lib/server/infrastructure/clients/externalClientPolicy';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import {
	buildDownloadFileName,
	contentTypeForExtension,
	fileExtensionFromName,
	hasText,
	parseContentDispositionFileName,
	sanitizeDownloadExtension
} from '$lib/server/infrastructure/search-providers/searchProviderDownloadUtils';
import type { SearchBooksRequest } from '$lib/types/Search/SearchBooksRequest';
import type { SearchResultBook } from '$lib/types/Search/SearchResultBook';

const ANNA_ARCHIVE_BROWSER_USER_AGENT =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const ANNA_LIBGEN_ADS_BASE_URL = 'https://libgen.li/ads.php';
const ANNA_MAX_FILTERED_SEARCH_PAGES = 5;
const ANNA_MAX_REDIRECTS = 3;

const ANNA_SEARCH_COMPATIBILITY_MARKERS = [
	'anna\'s archive',
	'anna’s archive'
] as const;

const annaLibgenGetLinkRegex = /href="(get\.php\?md5=[^"]+)"/i;

const ANNA_BOOK_CAPABILITIES = {
	filesAvailable: true,
	metadataCompleteness: 'medium'
} as const;

const resultAnchorRegex =
	/<a href="\/md5\/([a-f0-9]{32})" class="custom-a block mr-2 sm:mr-4 hover:opacity-80">/g;
const titleRegex =
	/<a href="\/md5\/[^"]+"[^>]*font-semibold text-lg[^"]*"[^>]*>([\s\S]*?)<\/a>/i;
const authorsRegex =
	/<a href="\/search\?q=[^"]*"[^>]*><span class="icon-\[mdi--user-edit\][^"]*"><\/span>\s*([\s\S]*?)<\/a>/i;
const metadataRegex = /<div class="text-gray-800[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
const coverRegex = /<img [^>]*src="([^"]+)"/i;

export interface AnnaArchiveSearchProviderDependencies {
	getMirrorUrls?: () => Promise<readonly string[]>;
	fetchFn?: typeof fetch;
}

interface AnnaArchiveResponse {
	html: string;
}

export class AnnaArchiveRequestError extends Error {
	constructor(
		message: string,
		readonly kind: ExternalClientErrorKind | 'challenge' | 'invalid_response' | 'redirect',
		readonly status = 502,
		readonly cause?: unknown
	) {
		super(message);
		this.name = 'AnnaArchiveRequestError';
	}
}

interface AnnaMetaInformation {
	language: string | null;
	format: string | null;
	sizeBytes: number | null;
	year: number | null;
	sourceFamily: string | null;
}

const ANNA_LANGUAGE_FILTER_CODES: Record<string, string> = {
	english: 'en',
	german: 'de',
	french: 'fr',
	spanish: 'es',
	en: 'en',
	de: 'de',
	fr: 'fr',
	es: 'es'
};

const ANNA_LANGUAGE_ALIASES: Record<string, string[]> = {
	english: ['english', 'en', 'eng'],
	german: ['german', 'de', 'deu', 'ger'],
	french: ['french', 'fr', 'fra', 'fre'],
	spanish: ['spanish', 'es', 'spa']
};

const ANNA_LANGUAGE_QUERY_HINTS: Record<string, string[]> = {
	english: ['english'],
	german: ['deutsch'],
	french: ['francais', 'french'],
	spanish: ['espanol', 'spanish']
};

function isValidCodePoint(codePoint: number): boolean {
	return (
		Number.isFinite(codePoint) &&
		codePoint >= 0 &&
		codePoint <= 0x10ffff &&
		!(codePoint >= 0xd800 && codePoint <= 0xdfff)
	);
}

function decodeHtml(value: string): string {
	return value
		.replace(/&#(\d+);/g, (match, code) => {
			const codePoint = Number(code);
			return isValidCodePoint(codePoint) ? String.fromCodePoint(codePoint) : match;
		})
		.replace(/&#x([0-9a-f]+);/gi, (match, code) => {
			const codePoint = Number.parseInt(code, 16);
			return isValidCodePoint(codePoint) ? String.fromCodePoint(codePoint) : match;
		})
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/&apos;/gi, "'")
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>');
}

function stripTags(html: string): string {
	return decodeHtml(html)
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function parseAbsoluteUrl(
	href: string | null | undefined,
	baseUrl: string
): string | null {
	const normalized = href?.trim();
	if (!normalized) {
		return null;
	}

	try {
		if (normalized.startsWith('/')) {
			return buildAnnaArchiveUrl(baseUrl, normalized);
		}
		return new URL(normalized, `${baseUrl}/`).toString();
	} catch {
		return null;
	}
}

function isAnnaSearchHtml(html: string): boolean {
	const normalized = html.toLowerCase();
	if (normalized.includes('/md5/')) {
		return true;
	}

	const identifiesAnnaArchive = ANNA_SEARCH_COMPATIBILITY_MARKERS.some((marker) =>
		normalized.includes(marker)
	);
	return (
		identifiesAnnaArchive &&
		(normalized.includes('content="book_any"') || normalized.includes('no results'))
	);
}

function isBrowserVerificationResponse(response: Response, html: string): boolean {
	const server = response.headers.get('server')?.toLowerCase() ?? '';
	const normalized = html.toLowerCase();
	return (
		server.includes('ddos-guard') ||
		normalized.includes('ddos-guard') ||
		normalized.includes('checking your browser') ||
		normalized.includes('browser verification')
	);
}

async function readResponseText(response: Response, maxBytes: number): Promise<string> {
	const contentLength = Number(response.headers.get('content-length') ?? '');
	if (Number.isFinite(contentLength) && contentLength > maxBytes) {
		throw new AnnaArchiveRequestError(
			'Anna search response exceeded the configured size limit',
			'invalid_response',
			502
		);
	}

	if (!response.body) {
		const text = await response.text();
		if (new TextEncoder().encode(text).byteLength > maxBytes) {
			throw new AnnaArchiveRequestError(
				'Anna search response exceeded the configured size limit',
				'invalid_response',
				502
			);
		}
		return text;
	}

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			totalBytes += value.byteLength;
			if (totalBytes > maxBytes) {
				await reader.cancel();
				throw new AnnaArchiveRequestError(
					'Anna search response exceeded the configured size limit',
					'invalid_response',
					502
				);
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	const body = new Uint8Array(totalBytes);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(body);
}

function parseSizeToBytes(value: string): number | null {
	const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB)$/i);
	if (!match) {
		return null;
	}

	const size = Number(match[1]);
	if (!Number.isFinite(size) || size <= 0) {
		return null;
	}

	const unit = match[2].toUpperCase();
	const multiplier =
		unit === 'KB'
			? 1024
			: unit === 'MB'
				? 1024 ** 2
				: unit === 'GB'
					? 1024 ** 3
					: 1024 ** 4;

	return Math.round(size * multiplier);
}

function normalizeLanguageToken(value: string): string {
	return value.trim().toLowerCase();
}

function normalizeExtensionToken(value: string): string {
	return value.trim().toLowerCase();
}

function languageFilterTokens(input: SearchBooksRequest): Set<string> {
	return new Set(
		(input.filters?.language ?? [])
			.map((value) => normalizeLanguageToken(value))
			.filter((value) => value.length > 0)
	);
}

function annaLanguageFilterCode(input: SearchBooksRequest): string | null {
	const requestedLanguages = [...languageFilterTokens(input)];
	if (requestedLanguages.length !== 1) {
		return null;
	}

	return ANNA_LANGUAGE_FILTER_CODES[requestedLanguages[0]] ?? null;
}

function annaExtensionFilter(input: SearchBooksRequest): string | null {
	const requestedExtensions = [...new Set((input.filters?.extension ?? []).map(normalizeExtensionToken))]
		.filter((value) => value.length > 0);
	if (requestedExtensions.length !== 1) {
		return null;
	}

	return requestedExtensions[0];
}

function annaQueryVariants(input: SearchBooksRequest): string[] {
	const baseQuery = input.query.trim();
	if (!baseQuery) {
		return [];
	}

	const variants = [baseQuery];
	const requestedLanguages = [...languageFilterTokens(input)];
	if (requestedLanguages.length !== 1) {
		return variants;
	}

	const matchingHints = new Set<string>();
	for (const requestedLanguage of requestedLanguages) {
		for (const [canonicalLanguage, aliases] of Object.entries(ANNA_LANGUAGE_ALIASES)) {
			if (canonicalLanguage === requestedLanguage || aliases.includes(requestedLanguage)) {
				for (const hint of ANNA_LANGUAGE_QUERY_HINTS[canonicalLanguage] ?? []) {
					matchingHints.add(hint);
				}
			}
		}
	}

	for (const hint of matchingHints) {
		if (baseQuery.toLowerCase().includes(hint.toLowerCase())) {
			continue;
		}

		variants.push(`${baseQuery} ${hint}`);
	}

	return variants;
}

function buildAnnaSearchUrl(baseUrl: string, input: SearchBooksRequest, page = 1): string {
	const url = new URL(buildAnnaArchiveUrl(baseUrl, 'search'));
	url.searchParams.set('q', input.query);
	url.searchParams.set('content', 'book_any');

	const languageCode = annaLanguageFilterCode(input);
	if (languageCode) {
		url.searchParams.set('lang', languageCode);
	}

	const extension = annaExtensionFilter(input);
	if (extension) {
		url.searchParams.set('ext', extension);
	}

	if (page > 1) {
		url.searchParams.set('page', String(page));
	}

	return url.toString();
}

function shouldPaginateFilteredSearch(input: SearchBooksRequest): boolean {
	return Boolean(
		(input.filters?.language?.length ?? 0) > 0 ||
			(input.filters?.extension?.length ?? 0) > 0 ||
			typeof input.filters?.yearFrom === 'number' ||
			typeof input.filters?.yearTo === 'number'
	);
}

function extractMetaInformation(meta: string): AnnaMetaInformation {
	const parts = meta
		.split(' · ')
		.map((part) => part.trim())
		.filter(Boolean);

	if (parts.length < 2) {
		return { language: null, format: null, sizeBytes: null, year: null, sourceFamily: null };
	}

	let language: string | null = null;
	let format: string | null = null;
	let sizeBytes: number | null = null;
	let year: number | null = null;
	let sourceFamily: string | null = null;

	const firstPart = parts[0];
	const bracketIndex = firstPart.indexOf('[');
	if (bracketIndex > 0) {
		const normalizedLanguage = firstPart.slice(0, bracketIndex).replace(/^✅\s*/, '').trim();
		language = normalizedLanguage.length > 0 ? normalizedLanguage : null;
	}

	for (const part of parts.slice(1)) {
		if (format === null) {
			const formatMatch = part.match(/\b(EPUB|PDF|MOBI|AZW3|AZW|DJVU|CBZ|CBR|FB2|DOCX?|TXT|LIT)\b/i);
			if (formatMatch) {
				format = formatMatch[1].toLowerCase();
			}
		}

		if (sizeBytes === null) {
			sizeBytes = parseSizeToBytes(part);
		}

		if (year === null) {
			const yearMatch = part.match(/\b(1[5-9]\d{2}|20\d{2}|2100)\b/);
			if (yearMatch) {
				const parsedYear = Number(yearMatch[1]);
				year = Number.isFinite(parsedYear) ? parsedYear : null;
			}
		}

		if (sourceFamily === null) {
			const normalizedPart = part.replace(/^🚀\s*/, '').trim();
			const looksLikeSourcePath =
				normalizedPart.includes('/') ||
				normalizedPart.toLowerCase() === 'ia' ||
				normalizedPart.toLowerCase() === 'zlib';
			if (looksLikeSourcePath && /^(?:\/)?[a-z0-9][a-z0-9/_-]*$/i.test(normalizedPart)) {
				const family = normalizedPart.replace(/^\/+/, '').split('/')[0]?.toLowerCase() ?? null;
				sourceFamily = family && family.length > 0 ? family : null;
			}
		}
	}

	return { language, format, sizeBytes, year, sourceFamily };
}

function supportsAnnaDownload(sourceFamily: string | null): boolean {
	// The current server-side Anna downloader resolves files through the Libgen mirror fallback.
	// IA-backed records are a known false positive and should not expose file actions.
	return sourceFamily !== 'ia';
}

function matchesLanguageFilter(language: string | null, tokens: Set<string>): boolean {
	if (tokens.size === 0) {
		return true;
	}
	if (!language) {
		return false;
	}

	const normalized = normalizeLanguageToken(language);
	const candidates = new Set([normalized]);

	for (const [canonicalLanguage, aliases] of Object.entries(ANNA_LANGUAGE_ALIASES)) {
		if (canonicalLanguage === normalized || aliases.includes(normalized)) {
			candidates.add(canonicalLanguage);
			for (const alias of aliases) {
				candidates.add(alias);
			}
		}
	}

	return [...candidates].some((candidate) => tokens.has(candidate));
}

function matchesExtensionFilter(format: string | null, input: SearchBooksRequest): boolean {
	const requestedExtensions = input.filters?.extension ?? [];
	if (requestedExtensions.length === 0) {
		return true;
	}
	if (!format) {
		return false;
	}

	const normalizedFormat = format.toLowerCase();
	return requestedExtensions.some((value) => value.trim().toLowerCase() === normalizedFormat);
}

function matchesYearFilter(year: number | null, input: SearchBooksRequest): boolean {
	if (year === null) {
		return true;
	}

	const yearFrom = input.filters?.yearFrom;
	const yearTo = input.filters?.yearTo;

	if (typeof yearFrom === 'number' && year < yearFrom) {
		return false;
	}
	if (typeof yearTo === 'number' && year > yearTo) {
		return false;
	}

	return true;
}

function mapBook(
	segment: string,
	hash: string,
	input: SearchBooksRequest,
	languageTokens: Set<string>,
	baseUrl: string
): SearchResultBook | null {
	const title = stripTags(segment.match(titleRegex)?.[1] ?? '');
	if (!title) {
		return null;
	}

	const author = stripTags(segment.match(authorsRegex)?.[1] ?? '') || null;
	const meta = stripTags(segment.match(metadataRegex)?.[1] ?? '');
	const cover = parseAbsoluteUrl(segment.match(coverRegex)?.[1] ?? null, baseUrl);
	const { language, format, sizeBytes, year, sourceFamily } = extractMetaInformation(meta);
	const filesAvailable = supportsAnnaDownload(sourceFamily);

	if (!matchesLanguageFilter(language, languageTokens)) {
		return null;
	}
	if (!matchesExtensionFilter(format, input)) {
		return null;
	}
	if (!matchesYearFilter(year, input)) {
		return null;
	}

	return {
		provider: 'anna',
		providerBookId: hash,
		title,
		author,
		language,
		year,
		extension: format,
		filesize: sizeBytes,
		cover,
		description: null,
		series: null,
		volume: null,
		seriesIndex: null,
		identifier: null,
		isbn: null,
		pages: null,
		capabilities: {
			...ANNA_BOOK_CAPABILITIES,
			filesAvailable
		},
		downloadRef: filesAvailable ? hash : null,
		queueRef: null,
		sourceUrl: buildAnnaArchiveUrl(baseUrl, `/md5/${hash}`)
	};
}

async function fetchAnnaSearchResponse(
	fetchFn: typeof fetch,
	searchUrl: string,
	baseUrl: string,
	deadline: number
): Promise<AnnaArchiveResponse> {
	const controller = new AbortController();
	const timeoutMs = Math.max(1, Math.min(ANNA_ARCHIVE_REQUEST_TIMEOUT_MS, deadline - Date.now()));
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	let currentUrl = searchUrl;
	const baseOrigin = new URL(baseUrl).origin;

	try {
		for (let redirectCount = 0; redirectCount <= ANNA_MAX_REDIRECTS; redirectCount += 1) {
			let response: Response;
			try {
				response = await fetchFn(currentUrl, {
					headers: {
						Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
						'User-Agent': ANNA_ARCHIVE_BROWSER_USER_AGENT
					},
					redirect: 'manual',
					signal: controller.signal
				});
			} catch (cause: unknown) {
				if (cause instanceof Error && cause.name === 'AbortError') {
					throw new AnnaArchiveRequestError('Anna search request timed out', 'timeout', 504, cause);
				}
				throw new AnnaArchiveRequestError('Anna search request failed', 'network', 502, cause);
			}

			if (response.status >= 300 && response.status < 400) {
				const location = response.headers.get('location');
				if (!location) {
					throw new AnnaArchiveRequestError('Anna search returned an invalid redirect', 'redirect', 502);
				}
				const nextUrl = new URL(location, currentUrl);
				if (nextUrl.origin !== baseOrigin) {
					throw new AnnaArchiveRequestError(
						'Anna search returned a cross-origin redirect',
						'redirect',
						502
					);
				}
				currentUrl = nextUrl.toString();
				continue;
			}

			let html: string;
			try {
				html = await readResponseText(response, ANNA_ARCHIVE_MAX_RESPONSE_BYTES);
			} catch (cause: unknown) {
				if (cause instanceof AnnaArchiveRequestError) {
					throw cause;
				}
				if (cause instanceof Error && cause.name === 'AbortError') {
					throw new AnnaArchiveRequestError('Anna search response timed out', 'timeout', 504, cause);
				}
				throw new AnnaArchiveRequestError('Anna search response could not be read', 'network', 502, cause);
			}
			if (isBrowserVerificationResponse(response, html)) {
				throw new AnnaArchiveRequestError(
					'Anna search was blocked by browser verification',
					'challenge',
					502
				);
			}
			if (!response.ok) {
				const kind: ExternalClientErrorKind =
					response.status === 401 || response.status === 403
						? 'authentication'
						: response.status === 429
							? 'rate_limit'
							: response.status >= 500
								? 'upstream'
								: 'invalid_response';
				throw new AnnaArchiveRequestError(
					`Anna search failed with status ${response.status}`,
					kind,
					response.status
				);
			}
			if (!isAnnaSearchHtml(html)) {
				throw new AnnaArchiveRequestError(
					'Anna mirror returned an unsupported search page',
					'invalid_response',
					502
				);
			}

			return { html };
		}
	} finally {
		clearTimeout(timeout);
	}

	throw new AnnaArchiveRequestError('Anna search exceeded the redirect limit', 'redirect', 502);
}

async function searchAnnaMirror(
	baseUrl: string,
	input: SearchBooksRequest,
	fetchFn: typeof fetch,
	deadline: number
): Promise<ApiResult<SearchResultBook[]>> {
	const limit = Math.max(1, Math.min(input.filters?.limitPerProvider ?? 20, 50));
	const languageTokens = languageFilterTokens(input);
	const maxPages = shouldPaginateFilteredSearch(input) ? ANNA_MAX_FILTERED_SEARCH_PAGES : 1;
	const queryVariants = annaQueryVariants(input);

	for (const query of queryVariants) {
		const books: SearchResultBook[] = [];
		const seenHashes = new Set<string>();

		for (let page = 1; page <= maxPages && books.length < limit; page += 1) {
			const searchUrl = buildAnnaSearchUrl(baseUrl, { ...input, query }, page);
			const { html } = await fetchAnnaSearchResponse(fetchFn, searchUrl, baseUrl, deadline);
			const matches = [...html.matchAll(resultAnchorRegex)];

			if (matches.length === 0) {
				if (page === 1) break;
				continue;
			}

			for (let index = 0; index < matches.length; index += 1) {
				if (books.length >= limit) break;

				const match = matches[index];
				const nextMatch = matches[index + 1];
				const hash = match[1];
				if (seenHashes.has(hash)) continue;

				const start = match.index ?? 0;
				const end = nextMatch?.index ?? html.length;
				const segment = html.slice(start, end);
				const book = mapBook(segment, hash, input, languageTokens, baseUrl);
				if (book) {
					seenHashes.add(hash);
					books.push(book);
				}
			}
		}

		if (books.length > 0) return apiOk(books);
	}

	return apiOk([]);
}

export class AnnaArchiveSearchProvider implements SearchProviderPort, SearchProviderDownloadPort {
	readonly id = 'anna' as const;
	private readonly getMirrorUrls: () => Promise<readonly string[]>;
	private readonly fetchFn: typeof fetch;

	constructor(dependencies: AnnaArchiveSearchProviderDependencies = {}) {
		this.getMirrorUrls =
			dependencies.getMirrorUrls ?? (() => Promise.resolve([DEFAULT_ANNA_ARCHIVE_BASE_URL]));
		this.fetchFn = dependencies.fetchFn ?? fetch;
	}

	async search(
		input: SearchBooksRequest,
		_context: SearchProviderContext
	): Promise<ApiResult<SearchResultBook[]>> {
		try {
			const mirrors = normalizeAnnaArchiveMirrorUrls([...(await this.getMirrorUrls())]);
			const deadline = Date.now() + ANNA_ARCHIVE_MIRROR_FAILOVER_TIMEOUT_MS;
			const failures: unknown[] = [];

			for (const mirror of mirrors) {
				if (Date.now() >= deadline) break;
				try {
					return await searchAnnaMirror(mirror, input, this.fetchFn, deadline);
				} catch (cause: unknown) {
					failures.push(cause);
				}
			}

			const browserVerificationBlocked =
				failures.length > 0 &&
				failures.every(
					(failure) => failure instanceof AnnaArchiveRequestError && failure.kind === 'challenge'
				);
			const message = browserVerificationBlocked
				? "Anna's Archive search was blocked by browser verification on all configured mirrors. Configure a reachable Anna-compatible mirror or proxy in Settings → Integrations."
				: "Anna's Archive search failed on all configured mirrors. Configure a reachable Anna-compatible mirror or proxy in Settings → Integrations.";
			return apiError(message, 502, failures.at(-1));
		} catch (cause: unknown) {
			return apiError("Anna's Archive mirror configuration is invalid", 500, cause);
		}
	}

	async download(
		input: SearchProviderDownloadInput
	): Promise<
		ApiResult<{
			success: true;
			fileName: string;
			fileData: Uint8Array;
			contentType: string;
		}>
	> {
		const md5 = input.downloadRef.trim().toLowerCase();
		if (!/^[a-f0-9]{32}$/.test(md5)) {
			return apiError('Invalid Anna download reference', 400);
		}

		try {
			const libgenAdsUrl = `${ANNA_LIBGEN_ADS_BASE_URL}?md5=${encodeURIComponent(md5)}`;
			const adsResponse = await this.fetchFn(libgenAdsUrl, {
				headers: {
					Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					'User-Agent': ANNA_ARCHIVE_BROWSER_USER_AGENT
				}
			});
			if (!adsResponse.ok) {
				return apiError(`Anna mirror lookup failed with status ${adsResponse.status}`, 502);
			}

			const adsHtml = await adsResponse.text();
			const relativeGetLink = adsHtml.match(annaLibgenGetLinkRegex)?.[1];
			if (!hasText(relativeGetLink)) {
				return apiError('No supported Anna download mirror was found for this book', 404);
			}

			const getUrl = new URL(relativeGetLink, libgenAdsUrl).toString();
			const response = await this.fetchFn(getUrl, {
				headers: {
					'User-Agent': ANNA_ARCHIVE_BROWSER_USER_AGENT
				}
			});
			if (!response.ok) {
				return apiError(`Anna download failed with status ${response.status}`, 502);
			}

			const contentType =
				(response.headers.get('content-type') ?? 'application/octet-stream').toLowerCase();
			if (contentType.includes('text/html')) {
				return apiError('Anna download resolved to an HTML page instead of a file', 502);
			}

			const fileData = new Uint8Array(await response.arrayBuffer());
			const fallbackExtension = sanitizeDownloadExtension(input.extension);
			const headerFileName = parseContentDispositionFileName(response.headers)?.trim();
			const headerExtension = headerFileName ? fileExtensionFromName(headerFileName) : null;
			const useHeaderFileName =
				headerFileName !== null &&
				headerExtension !== null &&
				sanitizeDownloadExtension(headerExtension) === headerExtension;
			const resolvedExtension = useHeaderFileName ? headerExtension : fallbackExtension;
			const fileName =
				useHeaderFileName && headerFileName
					? headerFileName
					: buildDownloadFileName(input.title, resolvedExtension);

			return apiOk({
				success: true,
				fileName,
				fileData,
				contentType: contentType || contentTypeForExtension(resolvedExtension)
			});
		} catch (cause: unknown) {
			return apiError('Anna download failed', 502, cause);
		}
	}
}
