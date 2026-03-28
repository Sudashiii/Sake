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
	normalizePreferredDownloadExtension,
	parseUrl
} from '$lib/server/infrastructure/search-providers/searchProviderDownloadUtils';
import type { SearchBooksRequest } from '$lib/types/Search/SearchBooksRequest';
import type { SearchResultBook } from '$lib/types/Search/SearchResultBook';

interface GutendexAuthor {
	name?: string;
}

interface GutendexBook {
	id?: number;
	title?: string;
	authors?: GutendexAuthor[];
	languages?: string[];
	formats?: Record<string, string>;
}

interface GutendexPayload {
	results?: GutendexBook[];
}

const GUTENBERG_BOOK_CAPABILITIES = {
	filesAvailable: true,
	metadataCompleteness: 'medium'
} as const;

function isTrustedGutenbergHost(hostname: string): boolean {
	return hostname === 'gutenberg.org' || hostname.endsWith('.gutenberg.org');
}

function preferredExtensions(input: SearchBooksRequest): string[] {
	const requested = input.filters?.extension ?? [];
	const normalized = requested
		.map((value) => value.toLowerCase().trim())
		.filter((value) => value === 'epub' || value === 'pdf' || value === 'mobi');
	if (normalized.length > 0) {
		return [...new Set(normalized)];
	}
	return ['epub', 'pdf', 'mobi'];
}

function formatCandidates(extension: string): string[] {
	switch (extension) {
		case 'epub':
			return ['application/epub+zip'];
		case 'pdf':
			return ['application/pdf'];
		case 'mobi':
			return ['application/x-mobipocket-ebook'];
		default:
			return [];
	}
}

function pickDownload(formats: Record<string, string>, input: SearchBooksRequest): {
	url: string | null;
	extension: string | null;
} {
	const extensions = preferredExtensions(input);
	for (const extension of extensions) {
		for (const mimeType of formatCandidates(extension)) {
			const value = formats[mimeType];
			if (hasText(value)) {
				return { url: value, extension };
			}
		}
	}

	// Fallback order when filter did not match.
	for (const fallbackExtension of ['epub', 'pdf', 'mobi']) {
		for (const mimeType of formatCandidates(fallbackExtension)) {
			const value = formats[mimeType];
			if (hasText(value)) {
				return { url: value, extension: fallbackExtension };
			}
		}
	}

	return { url: null, extension: null };
}

function mapBook(book: GutendexBook, input: SearchBooksRequest): SearchResultBook | null {
	if (typeof book.id !== 'number' || !Number.isFinite(book.id) || !hasText(book.title)) {
		return null;
	}

	const formats = book.formats ?? {};
	const download = pickDownload(formats, input);
	const filesAvailable = Boolean(download.url);

	return {
		provider: 'gutenberg',
		providerBookId: String(book.id),
		title: book.title.trim(),
		author: book.authors?.find((author) => hasText(author.name))?.name ?? null,
		language: book.languages?.find((language) => hasText(language)) ?? null,
		year: null,
		extension: download.extension,
		filesize: null,
		cover: null,
		description: null,
		series: null,
		volume: null,
		seriesIndex: null,
		identifier: String(book.id),
		isbn: null,
		pages: null,
		capabilities: {
			...GUTENBERG_BOOK_CAPABILITIES,
			filesAvailable
		},
		downloadRef: download.url,
		queueRef: null,
		sourceUrl: `https://www.gutenberg.org/ebooks/${book.id}`
	};
}

export class GutenbergSearchProvider implements SearchProviderPort, SearchProviderDownloadPort {
	readonly id = 'gutenberg' as const;

	async search(
		input: SearchBooksRequest,
		_context: SearchProviderContext
	): Promise<ApiResult<SearchResultBook[]>> {
		const url = `https://gutendex.com/books?search=${encodeURIComponent(input.query)}`;

		try {
			const response = await fetch(url, {
				headers: {
					Accept: 'application/json',
					'User-Agent': 'Sake/1.0 (+https://github.com/Sudashiii/Sake)'
				}
			});
			if (!response.ok) {
				return apiError(`Gutenberg search failed with status ${response.status}`, response.status);
			}

			const payload = (await response.json()) as GutendexPayload;
			const results = payload.results ?? [];
			const limit = Math.max(1, Math.min(input.filters?.limitPerProvider ?? 20, 100));

			const mapped: SearchResultBook[] = [];
			for (const result of results) {
				if (mapped.length >= limit) {
					break;
				}
				const book = mapBook(result, input);
				if (!book) {
					continue;
				}
				mapped.push(book);
			}

			return apiOk(mapped);
		} catch (cause: unknown) {
			return apiError('Gutenberg search failed', 502, cause);
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
		const url = parseUrl(input.downloadRef.trim());
		if (!url) {
			return apiError('Invalid Gutenberg download URL', 400);
		}
		if (url.protocol !== 'https:') {
			return apiError('Unsupported Gutenberg download URL protocol', 400);
		}
		if (!isTrustedGutenbergHost(url.hostname)) {
			return apiError('Untrusted Gutenberg download host', 400);
		}

		try {
			const response = await fetch(url, {
				headers: {
					'User-Agent': 'Sake/1.0 (+https://github.com/Sudashiii/Sake)'
				}
			});
			if (!response.ok) {
				return apiError(`Gutenberg download failed with status ${response.status}`, 502);
			}

			const fileData = new Uint8Array(await response.arrayBuffer());
			const extension = normalizePreferredDownloadExtension(
				input.extension ?? fileExtensionFromName(url.pathname) ?? 'epub'
			);
			const contentType =
				response.headers.get('content-type') ?? contentTypeForExtension(extension);

			return apiOk({
				success: true,
				fileName: buildDownloadFileName(input.title, extension),
				fileData,
				contentType
			});
		} catch (cause: unknown) {
			return apiError('Gutenberg download failed', 502, cause);
		}
	}
}
