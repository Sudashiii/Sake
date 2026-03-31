import type {
	SearchProviderContext,
	SearchProviderDownloadInput,
	SearchProviderDownloadPort,
	SearchProviderPort
} from '$lib/server/application/ports/SearchProviderPort';
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

const ANNA_ARCHIVE_BASE_URL = 'https://annas-archive.gl';
const ANNA_ARCHIVE_BROWSER_USER_AGENT =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const ANNA_LIBGEN_ADS_BASE_URL = 'https://libgen.li/ads.php';

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

interface AnnaMetaInformation {
	language: string | null;
	format: string | null;
	sizeBytes: number | null;
	year: number | null;
	sourceFamily: string | null;
}

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

function parseAbsoluteUrl(href: string | null | undefined): string | null {
	const normalized = href?.trim();
	if (!normalized) {
		return null;
	}

	try {
		return new URL(normalized, ANNA_ARCHIVE_BASE_URL).toString();
	} catch {
		return null;
	}
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

function languageFilterTokens(input: SearchBooksRequest): Set<string> {
	return new Set(
		(input.filters?.language ?? [])
			.map((value) => normalizeLanguageToken(value))
			.filter((value) => value.length > 0)
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
	return tokens.has(normalized);
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
	languageTokens: Set<string>
): SearchResultBook | null {
	const title = stripTags(segment.match(titleRegex)?.[1] ?? '');
	if (!title) {
		return null;
	}

	const author = stripTags(segment.match(authorsRegex)?.[1] ?? '') || null;
	const meta = stripTags(segment.match(metadataRegex)?.[1] ?? '');
	const cover = parseAbsoluteUrl(segment.match(coverRegex)?.[1] ?? null);
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
		sourceUrl: `${ANNA_ARCHIVE_BASE_URL}/md5/${hash}`
	};
}

export class AnnaArchiveSearchProvider implements SearchProviderPort, SearchProviderDownloadPort {
	readonly id = 'anna' as const;

	async search(
		input: SearchBooksRequest,
		_context: SearchProviderContext
	): Promise<ApiResult<SearchResultBook[]>> {
		const limit = Math.max(1, Math.min(input.filters?.limitPerProvider ?? 20, 50));
		const languageTokens = languageFilterTokens(input);
		const searchUrl = `${ANNA_ARCHIVE_BASE_URL}/search?q=${encodeURIComponent(input.query)}&content=book_any`;

		try {
			const response = await fetch(searchUrl, {
				headers: {
					Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					'User-Agent': ANNA_ARCHIVE_BROWSER_USER_AGENT
				}
			});

			if (!response.ok) {
				return apiError(`Anna search failed with status ${response.status}`, response.status);
			}

			const html = await response.text();
			if (html.includes('DDoS-Guard')) {
				return apiError('Anna search was blocked by browser verification', 502);
			}

			const matches = [...html.matchAll(resultAnchorRegex)];
			const books: SearchResultBook[] = [];

			for (let index = 0; index < matches.length; index += 1) {
				if (books.length >= limit) {
					break;
				}

				const match = matches[index];
				const nextMatch = matches[index + 1];
				const hash = match[1];
				const start = match.index ?? 0;
				const end = nextMatch?.index ?? html.length;
				const segment = html.slice(start, end);
				const book = mapBook(segment, hash, input, languageTokens);
				if (book) {
					books.push(book);
				}
			}

			return apiOk(books);
		} catch (cause: unknown) {
			return apiError('Anna search failed', 502, cause);
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
			const adsResponse = await fetch(libgenAdsUrl, {
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
			const response = await fetch(getUrl, {
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
