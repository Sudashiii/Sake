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

// Anna's Archive puts anonymous /search and /md5 requests behind a DDoS-Guard JS challenge that
// server-side fetch cannot pass. Search and downloads therefore go through Libgen, which serves the
// same md5 file identifiers; Anna's Archive is only linked as the result source page.
const ANNA_ARCHIVE_BASE_URL = 'https://annas-archive.gl';
const ANNA_ARCHIVE_BROWSER_USER_AGENT =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const ANNA_MAX_FILTERED_SEARCH_PAGES = 5;

const LIBGEN_HOSTS = ['libgen.li', 'libgen.gl', 'libgen.bz', 'libgen.la'] as const;
const LIBGEN_REQUEST_TIMEOUT_MS = 20_000;
const LIBGEN_DOWNLOAD_ROUNDS = 2;
const LIBGEN_SEARCH_COLUMNS = ['t', 'a', 's', 'y', 'p', 'i'] as const;
const LIBGEN_SEARCH_TOPICS = ['l', 'f'] as const;
const LIBGEN_RESULTS_TABLE_MARKER = 'id="tablelibgen"';
// Every search response (including zero hits, which render no table) has the "Files <count>" tab.
const libgenFileCountRegex = />Files\s*<span class="badge[^"]*">\s*\d+\s*<\/span>/i;
const LIBGEN_MIN_RESULT_CELLS = 9;

const libgenGetLinkRegex = /href="(get\.php\?md5=[^"]+)"/i;
const libgenMd5Regex = /ads\.php\?md5=([a-f0-9]{32})/i;
const libgenSeriesRegex = /^\s*<b>([\s\S]*?)<\/b>/i;
const libgenTitleRegex = /href="edition\.php\?id=\d+"[^>]*>([\s\S]*?)<\/a>/i;
const libgenIsbnRegex = /<font color="green">([\s\S]*?)<\/font>/i;
const libgenAuthorRoleRegex = /\s*\([a-z]{2,4}\.?\)/g;
const yearRegex = /\b(1[5-9]\d{2}|20\d{2}|2100)\b/;

const ANNA_BOOK_CAPABILITIES = {
	filesAvailable: true,
	metadataCompleteness: 'medium'
} as const;

const ANNA_LANGUAGE_ALIASES: Record<string, string[]> = {
	english: ['english', 'en', 'eng'],
	german: ['german', 'de', 'deu', 'ger'],
	french: ['french', 'fr', 'fra', 'fre'],
	spanish: ['spanish', 'es', 'spa']
};

interface LibgenSearchPage {
	host: string;
	html: string;
}

interface LibgenResultRow {
	md5: string;
	title: string;
	series: string | null;
	author: string | null;
	year: number | null;
	language: string | null;
	filesize: number | null;
	extension: string | null;
	isbn: string | null;
}

type LibgenFileAttempt =
	| { ok: true; response: Response; fileData: Uint8Array }
	| { ok: false; notFound: boolean; reason: string; cause?: unknown };

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
	return decodeHtml(
		html
			.replace(/<script[\s\S]*?<\/script>/gi, ' ')
			.replace(/<style[\s\S]*?<\/style>/gi, ' ')
			.replace(/<[^>]+>/g, ' ')
	)
		.replace(/\s+/g, ' ')
		.trim();
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

function parseYear(value: string): number | null {
	const match = value.match(yearRegex);
	return match ? Number(match[1]) : null;
}

function parseIsbn(value: string): string | null {
	const candidates = value
		.split(/[;,\s]+/)
		.map((candidate) => candidate.trim().toUpperCase())
		.filter((candidate) => /^(?:\d{13}|\d{9}[\dX])$/.test(candidate));
	return candidates.find((candidate) => candidate.length === 13) ?? candidates[0] ?? null;
}

function parseAuthor(value: string): string | null {
	const author = value
		.replace(libgenAuthorRoleRegex, '')
		.split(';')
		.map((part) => part.trim())
		.filter(Boolean)
		.join('; ');
	return author.length > 0 ? author : null;
}

function parseSeries(value: string): string | null {
	const series = value.split(';')[0]?.trim() ?? '';
	return series.length > 0 ? series : null;
}

function parseLibgenRow(rowHtml: string): LibgenResultRow | null {
	const md5 = rowHtml.match(libgenMd5Regex)?.[1]?.toLowerCase();
	if (!md5) {
		return null;
	}

	const cells = rowHtml
		.split(/<td(?=[\s>])/i)
		.slice(1)
		.map((cell) => cell.slice(cell.indexOf('>') + 1));
	if (cells.length < LIBGEN_MIN_RESULT_CELLS) {
		return null;
	}

	const [titleCell, authorCell, , yearCell, languageCell, , sizeCell, extensionCell] = cells;
	// The title anchor appends edition details in <i>; keep only the title itself.
	const title = stripTags(
		(titleCell.match(libgenTitleRegex)?.[1] ?? '').replace(/<i>[\s\S]*?<\/i>/gi, ' ')
	);
	if (!title) {
		return null;
	}

	const language = stripTags(languageCell);
	const extension = stripTags(extensionCell).toLowerCase();

	return {
		md5,
		title,
		series: parseSeries(stripTags(titleCell.match(libgenSeriesRegex)?.[1] ?? '')),
		author: parseAuthor(stripTags(authorCell)),
		year: parseYear(stripTags(yearCell)),
		language: language.length > 0 ? language : null,
		filesize: parseSizeToBytes(stripTags(sizeCell)),
		extension: extension.length > 0 ? extension : null,
		isbn: parseIsbn(stripTags(titleCell.match(libgenIsbnRegex)?.[1] ?? ''))
	};
}

function parseLibgenResults(html: string): LibgenResultRow[] {
	const tableStart = html.indexOf(LIBGEN_RESULTS_TABLE_MARKER);
	if (tableStart < 0) {
		return [];
	}

	const tableEnd = html.indexOf('</table>', tableStart);
	const table = html.slice(tableStart, tableEnd < 0 ? html.length : tableEnd);
	return table
		.split(/<tr(?=[\s>])/i)
		.slice(1)
		.map(parseLibgenRow)
		.filter((row): row is LibgenResultRow => row !== null);
}

function buildLibgenSearchUrl(host: string, query: string, page: number, pageSize: number): string {
	const url = new URL('/index.php', `https://${host}`);
	url.searchParams.set('req', query);
	url.searchParams.set('res', String(pageSize));
	for (const column of LIBGEN_SEARCH_COLUMNS) {
		url.searchParams.append('columns[]', column);
	}
	url.searchParams.append('objects[]', 'f');
	for (const topic of LIBGEN_SEARCH_TOPICS) {
		url.searchParams.append('topics[]', topic);
	}
	if (page > 1) {
		url.searchParams.set('page', String(page));
	}

	return url.toString();
}

function orderedLibgenHosts(preferredHost: string | null): string[] {
	if (preferredHost === null) {
		return [...LIBGEN_HOSTS];
	}

	return [preferredHost, ...LIBGEN_HOSTS.filter((host) => host !== preferredHost)];
}

async function fetchLibgenSearchPage(
	query: string,
	page: number,
	pageSize: number,
	preferredHost: string | null
): Promise<ApiResult<LibgenSearchPage>> {
	let lastFailure = 'no Libgen mirror answered';
	let lastCause: unknown;

	for (const host of orderedLibgenHosts(preferredHost)) {
		try {
			const response = await fetch(buildLibgenSearchUrl(host, query, page, pageSize), {
				headers: {
					Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					'User-Agent': ANNA_ARCHIVE_BROWSER_USER_AGENT
				},
				signal: AbortSignal.timeout(LIBGEN_REQUEST_TIMEOUT_MS)
			});
			if (!response.ok) {
				lastFailure = `${host} answered with status ${response.status}`;
				continue;
			}

			const html = await response.text();
			if (!libgenFileCountRegex.test(html)) {
				lastFailure = `${host} returned an unexpected page`;
				continue;
			}

			return apiOk({ host, html });
		} catch (cause: unknown) {
			lastFailure = `${host} could not be reached`;
			lastCause = cause;
		}
	}

	return apiError(`Anna search failed: ${lastFailure}`, 502, lastCause);
}

async function fetchLibgenFile(host: string, md5: string): Promise<LibgenFileAttempt> {
	try {
		const adsUrl = `https://${host}/ads.php?md5=${encodeURIComponent(md5)}`;
		const adsResponse = await fetch(adsUrl, {
			headers: {
				Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				'User-Agent': ANNA_ARCHIVE_BROWSER_USER_AGENT
			},
			signal: AbortSignal.timeout(LIBGEN_REQUEST_TIMEOUT_MS)
		});
		if (!adsResponse.ok) {
			return {
				ok: false,
				notFound: false,
				reason: `${host} mirror lookup answered with status ${adsResponse.status}`
			};
		}

		const relativeGetLink = (await adsResponse.text()).match(libgenGetLinkRegex)?.[1];
		if (!hasText(relativeGetLink)) {
			return { ok: false, notFound: true, reason: `${host} has no download link for this book` };
		}

		const response = await fetch(new URL(decodeHtml(relativeGetLink), adsUrl), {
			headers: {
				'User-Agent': ANNA_ARCHIVE_BROWSER_USER_AGENT
			}
		});
		if (!response.ok) {
			await response.body?.cancel();
			return {
				ok: false,
				notFound: false,
				reason: `${host} download answered with status ${response.status}`
			};
		}

		const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
		if (contentType.includes('text/html')) {
			await response.body?.cancel();
			return {
				ok: false,
				notFound: false,
				reason: `${host} download resolved to an HTML page instead of a file`
			};
		}

		return { ok: true, response, fileData: new Uint8Array(await response.arrayBuffer()) };
	} catch (cause: unknown) {
		return { ok: false, notFound: false, reason: `${host} download failed`, cause };
	}
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

function shouldPaginateFilteredSearch(input: SearchBooksRequest): boolean {
	return Boolean(
		(input.filters?.language?.length ?? 0) > 0 ||
			(input.filters?.extension?.length ?? 0) > 0 ||
			typeof input.filters?.yearFrom === 'number' ||
			typeof input.filters?.yearTo === 'number'
	);
}

function matchesLanguageFilter(language: string | null, tokens: Set<string>): boolean {
	if (tokens.size === 0) {
		return true;
	}
	if (!language) {
		return false;
	}

	// Libgen lists multi-language files as "German;English".
	const candidates = new Set(
		language
			.split(/[;,]/)
			.map((value) => normalizeLanguageToken(value))
			.filter((value) => value.length > 0)
	);

	for (const candidate of [...candidates]) {
		for (const [canonicalLanguage, aliases] of Object.entries(ANNA_LANGUAGE_ALIASES)) {
			if (canonicalLanguage === candidate || aliases.includes(candidate)) {
				candidates.add(canonicalLanguage);
				for (const alias of aliases) {
					candidates.add(alias);
				}
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

function mapBook(row: LibgenResultRow): SearchResultBook {
	return {
		provider: 'anna',
		providerBookId: row.md5,
		title: row.title,
		author: row.author,
		language: row.language,
		year: row.year,
		extension: row.extension,
		filesize: row.filesize,
		cover: null,
		description: null,
		series: row.series,
		volume: null,
		seriesIndex: null,
		identifier: null,
		isbn: row.isbn,
		pages: null,
		capabilities: { ...ANNA_BOOK_CAPABILITIES },
		downloadRef: row.md5,
		queueRef: null,
		sourceUrl: `${ANNA_ARCHIVE_BASE_URL}/md5/${row.md5}`
	};
}

export class AnnaArchiveSearchProvider implements SearchProviderPort, SearchProviderDownloadPort {
	readonly id = 'anna' as const;

	async search(
		input: SearchBooksRequest,
		_context: SearchProviderContext
	): Promise<ApiResult<SearchResultBook[]>> {
		const query = input.query.trim();
		if (!query) {
			return apiOk([]);
		}

		const limit = Math.max(1, Math.min(input.filters?.limitPerProvider ?? 20, 50));
		const paginate = shouldPaginateFilteredSearch(input);
		const maxPages = paginate ? ANNA_MAX_FILTERED_SEARCH_PAGES : 1;
		const pageSize = !paginate && limit <= 25 ? 25 : 50;
		const languageTokens = languageFilterTokens(input);
		const books: SearchResultBook[] = [];
		const seenHashes = new Set<string>();
		let host: string | null = null;

		for (let page = 1; page <= maxPages && books.length < limit; page += 1) {
			const pageResult = await fetchLibgenSearchPage(query, page, pageSize, host);
			if (!pageResult.ok) {
				if (page === 1) {
					return pageResult;
				}
				break;
			}

			host = pageResult.value.host;
			const rows = parseLibgenResults(pageResult.value.html);
			for (const row of rows) {
				if (books.length >= limit) {
					break;
				}
				if (
					seenHashes.has(row.md5) ||
					!matchesLanguageFilter(row.language, languageTokens) ||
					!matchesExtensionFilter(row.extension, input) ||
					!matchesYearFilter(row.year, input)
				) {
					continue;
				}

				seenHashes.add(row.md5);
				books.push(mapBook(row));
			}

			if (rows.length < pageSize) {
				break;
			}
		}

		return apiOk(books);
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

		// The Libgen file CDN intermittently answers 503/522, so retry across mirrors before failing.
		let lastFailure: Extract<LibgenFileAttempt, { ok: false }> | null = null;
		for (let round = 0; round < LIBGEN_DOWNLOAD_ROUNDS; round += 1) {
			let everyMirrorLacksLink = true;
			for (const host of LIBGEN_HOSTS) {
				const attempt = await fetchLibgenFile(host, md5);
				if (!attempt.ok) {
					everyMirrorLacksLink &&= attempt.notFound;
					lastFailure = attempt;
					continue;
				}

				const { response, fileData } = attempt;
				const contentType = (
					response.headers.get('content-type') ?? 'application/octet-stream'
				).toLowerCase();
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
			}

			if (everyMirrorLacksLink) {
				return apiError('No supported Anna download mirror was found for this book', 404);
			}
		}

		return apiError(
			`Anna download failed: ${lastFailure?.reason ?? 'no Libgen mirror answered'}`,
			502,
			lastFailure?.cause
		);
	}
}
