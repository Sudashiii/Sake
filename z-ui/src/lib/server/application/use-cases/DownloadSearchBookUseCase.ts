import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import type { SearchProviderId } from '$lib/types/Search/Provider';

interface DownloadSearchBookInput {
	provider: SearchProviderId;
	downloadRef: string;
	title: string;
	extension?: string | null;
}

interface DownloadSearchBookResult {
	success: true;
	fileName: string;
	fileData: Uint8Array;
	contentType: string;
}

interface ArchiveMetadataFile {
	name?: string;
}

interface ArchiveMetadataPayload {
	files?: ArchiveMetadataFile[];
}

function sanitizeFileNamePart(value: string): string {
	const normalized = value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^A-Za-z0-9._-]+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '');
	return normalized.length > 0 ? normalized : 'book';
}

function normalizeExtension(extension: string | null | undefined): string {
	const normalized = (extension ?? '').toLowerCase().trim();
	if (normalized === 'pdf' || normalized === 'mobi' || normalized === 'azw3') {
		return normalized;
	}
	return 'epub';
}

function contentTypeForExtension(extension: string): string {
	switch (extension) {
		case 'pdf':
			return 'application/pdf';
		case 'mobi':
			return 'application/x-mobipocket-ebook';
		case 'azw3':
			return 'application/vnd.amazon.ebook';
		default:
			return 'application/epub+zip';
	}
}

function parseUrl(input: string): URL | null {
	try {
		return new URL(input);
	} catch {
		return null;
	}
}

function isTrustedGutenbergHost(hostname: string): boolean {
	return hostname === 'gutenberg.org' || hostname.endsWith('.gutenberg.org');
}

function encodePath(path: string): string {
	return path
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/');
}

function fileExtensionFromName(fileName: string): string | null {
	const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
	return match ? match[1] : null;
}

function rankOpenLibraryFile(fileName: string, preferredExtension: string): number {
	const lower = fileName.toLowerCase();
	if (lower.endsWith(`.${preferredExtension}`)) {
		return 100;
	}
	if (lower.endsWith('.epub')) {
		return 80;
	}
	if (lower.endsWith('.pdf')) {
		return 70;
	}
	if (lower.endsWith('.mobi')) {
		return 60;
	}
	if (lower.endsWith('.azw3')) {
		return 50;
	}
	return -1;
}

function hasText(value: string | null | undefined): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

export class DownloadSearchBookUseCase {
	async execute(input: DownloadSearchBookInput): Promise<ApiResult<DownloadSearchBookResult>> {
		const title = input.title.trim();
		if (!title) {
			return apiError('title is required', 400);
		}
		if (!hasText(input.downloadRef)) {
			return apiError('downloadRef is required', 400);
		}

		if (input.provider === 'openlibrary') {
			return this.downloadOpenLibrary(input);
		}

		if (input.provider === 'gutenberg') {
			return this.downloadGutenberg(input);
		}

		return apiError('Provider does not support generic search download', 400);
	}

	private async downloadOpenLibrary(
		input: DownloadSearchBookInput
	): Promise<ApiResult<DownloadSearchBookResult>> {
		const iaId = input.downloadRef.trim();
		const preferredExtension = normalizeExtension(input.extension);

		try {
			const metadataResponse = await fetch(
				`https://archive.org/metadata/${encodeURIComponent(iaId)}`,
				{
					headers: {
						Accept: 'application/json',
						'User-Agent': 'Sake/1.0 (+https://github.com/Sudashiii/Sake)'
					}
				}
			);
			if (!metadataResponse.ok) {
				return apiError(
					`OpenLibrary metadata lookup failed with status ${metadataResponse.status}`,
					502
				);
			}

			const metadataPayload = (await metadataResponse.json()) as ArchiveMetadataPayload;
			const files = metadataPayload.files ?? [];
			const fileNames = files
				.map((file) => file.name)
				.filter((name): name is string => hasText(name))
				.map((name) => name.trim());

			const selectedFileName = [...fileNames]
				.sort((left, right) => rankOpenLibraryFile(right, preferredExtension) - rankOpenLibraryFile(left, preferredExtension))
				.find((fileName) => rankOpenLibraryFile(fileName, preferredExtension) >= 0);

			if (!selectedFileName) {
				return apiError('No downloadable public-domain file found on OpenLibrary entry', 404);
			}

			const downloadUrl = `https://archive.org/download/${encodeURIComponent(iaId)}/${encodePath(selectedFileName)}`;
			const downloadResponse = await fetch(downloadUrl, {
				headers: {
					'User-Agent': 'Sake/1.0 (+https://github.com/Sudashiii/Sake)'
				}
			});
			if (!downloadResponse.ok) {
				return apiError(
					`OpenLibrary download failed with status ${downloadResponse.status}`,
					502
				);
			}

			const data = new Uint8Array(await downloadResponse.arrayBuffer());
			const detectedExtension = fileExtensionFromName(selectedFileName) ?? preferredExtension;
			const contentType =
				downloadResponse.headers.get('content-type') ?? contentTypeForExtension(detectedExtension);
			const fileName = `${sanitizeFileNamePart(input.title)}.${detectedExtension}`;

			return apiOk({
				success: true,
				fileName,
				fileData: data,
				contentType
			});
		} catch (cause: unknown) {
			return apiError('OpenLibrary download failed', 502, cause);
		}
	}

	private async downloadGutenberg(
		input: DownloadSearchBookInput
	): Promise<ApiResult<DownloadSearchBookResult>> {
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

			const data = new Uint8Array(await response.arrayBuffer());
			const rawExtension = input.extension ?? fileExtensionFromName(url.pathname) ?? 'epub';
			const extension = normalizeExtension(rawExtension);
			const contentType = response.headers.get('content-type') ?? contentTypeForExtension(extension);
			const fileName = `${sanitizeFileNamePart(input.title)}.${extension}`;

			return apiOk({
				success: true,
				fileName,
				fileData: data,
				contentType
			});
		} catch (cause: unknown) {
			return apiError('Gutenberg download failed', 502, cause);
		}
	}
}
