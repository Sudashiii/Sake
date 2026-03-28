import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import type { ZLibraryCredentials } from '$lib/server/application/ports/ZLibraryPort';
import type { SearchProviderId } from '$lib/types/Search/Provider';
import { createChildLogger, toLogError } from '$lib/server/infrastructure/logging/logger';

const ZLIBRARY_BASE_URL = 'https://1lib.sk';
const ANNA_ARCHIVE_COVER_HOST = 'annas-archive.gl';
const OPEN_LIBRARY_COVER_HOST = 'covers.openlibrary.org';
const LIBRARY_COVER_ROUTE_PREFIX = '/api/library/covers/';
const LIBRARY_COVER_STORAGE_PREFIX = 'covers/';
const DEFAULT_USER_AGENT = 'Sake/1.0 (+https://github.com/Sudashiii/Sake)';
const MANAGED_COVER_FILE_NAME_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpg|png|gif|webp|avif)$/i;

const IMAGE_CONTENT_TYPE_TO_EXTENSION = new Map<string, string>([
	['image/jpeg', 'jpg'],
	['image/jpg', 'jpg'],
	['image/png', 'png'],
	['image/gif', 'gif'],
	['image/webp', 'webp'],
	['image/avif', 'avif']
]);

export const MAX_MANAGED_BOOK_COVER_BYTES = 10 * 1024 * 1024;

export interface ManagedBookCoverResult {
	managedUrl: string | null;
	sourceUrl: string | null;
}

export interface StoreManagedBookCoverInput {
	bookStorageKey: string;
	provider: SearchProviderId;
	coverUrl: string | null | undefined;
	zlibraryCredentials?: ZLibraryCredentials;
}

export interface StoreExternalBookCoverInput {
	bookStorageKey: string;
	coverUrl: string | null | undefined;
}

export interface StoreManagedBookCoverBufferInput {
	bookStorageKey: string;
	coverBuffer: Buffer;
	contentType: string;
}

type FetchLike = typeof fetch;

function parseUrl(value: string): URL | null {
	try {
		return new URL(value);
	} catch {
		return null;
	}
}

function normalizeContentType(value: string | null): string | null {
	if (typeof value !== 'string') {
		return null;
	}

	const normalized = value.split(';', 1)[0]?.trim().toLowerCase() ?? '';
	return normalized.length > 0 ? normalized : null;
}

function buildZLibraryCookie(credentials: ZLibraryCredentials): string {
	return [
		'siteLanguageV2=en',
		`remix_userid=${credentials.userId}`,
		`remix_userkey=${credentials.userKey}`
	].join('; ');
}

function parseDeclaredSize(value: string | null): number | null {
	if (typeof value !== 'string' || value.trim().length === 0) {
		return null;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function readResponseBufferWithinLimit(input: {
	response: Response;
	maxBytes: number;
}): Promise<{ buffer: Buffer; byteLength: number; exceededLimit: boolean }> {
	if (input.response.body === null) {
		const buffer = Buffer.from(await input.response.arrayBuffer());
		return {
			buffer,
			byteLength: buffer.byteLength,
			exceededLimit: buffer.byteLength > input.maxBytes
		};
	}

	const reader = input.response.body.getReader();
	const chunks: Buffer[] = [];
	let total = 0;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}

			if (!value || value.byteLength === 0) {
				continue;
			}

			total += value.byteLength;
			if (total > input.maxBytes) {
				try {
					await reader.cancel('Managed cover payload exceeded the maximum size');
				} catch {
					// Ignore cancellation errors from already-closed streams.
				}

				return {
					buffer: Buffer.alloc(0),
					byteLength: total,
					exceededLimit: true
				};
			}

			chunks.push(Buffer.from(value));
		}
	} finally {
		reader.releaseLock();
	}

	return {
		buffer: Buffer.concat(chunks, total),
		byteLength: total,
		exceededLimit: false
	};
}

function extensionFromImageContentType(contentType: string | null): string | null {
	if (contentType === null) {
		return null;
	}

	return IMAGE_CONTENT_TYPE_TO_EXTENSION.get(contentType) ?? null;
}

function parseProtocolRelativeOrAbsoluteUrl(value: string): URL | null {
	try {
		if (value.startsWith('//')) {
			return new URL(`https:${value}`);
		}
		return new URL(value);
	} catch {
		return null;
	}
}

function parseIpv4Octets(hostname: string): number[] | null {
	const parts = hostname.split('.');
	if (parts.length !== 4) {
		return null;
	}

	const octets = parts.map((part) => Number(part));
	return octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255) ? octets : null;
}

function isBlockedManualImportHostname(hostname: string): boolean {
	const normalized = hostname.toLowerCase();
	if (
		normalized === 'localhost' ||
		normalized.endsWith('.localhost') ||
		normalized.endsWith('.local') ||
		normalized === '0.0.0.0' ||
		normalized === '::1' ||
		normalized === '[::1]'
	) {
		return true;
	}

	const ipv4 = parseIpv4Octets(normalized);
	if (ipv4 !== null) {
		const [a, b] = ipv4;
		return (
			a === 0 ||
			a === 10 ||
			a === 127 ||
			(a === 169 && b === 254) ||
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && b === 168) ||
			(a === 100 && b >= 64 && b <= 127) ||
			(a === 198 && (b === 18 || b === 19))
		);
	}

	const bareIpv6 = normalized.startsWith('[') && normalized.endsWith(']')
		? normalized.slice(1, -1)
		: normalized;
	return (
		bareIpv6.startsWith('fc') ||
		bareIpv6.startsWith('fd') ||
		bareIpv6.startsWith('fe80:')
	);
}

export function buildManagedBookCoverFileName(bookStorageKey: string, extension: string): string {
	return `${bookStorageKey}.${extension}`;
}

export function buildManagedBookCoverStorageKey(fileName: string): string {
	return `${LIBRARY_COVER_STORAGE_PREFIX}${fileName}`;
}

export function buildManagedBookCoverUrl(fileName: string): string {
	return `${LIBRARY_COVER_ROUTE_PREFIX}${encodeURIComponent(fileName)}`;
}

export function buildManagedBookCoverPrefix(bookStorageKey: string): string {
	return `${LIBRARY_COVER_STORAGE_PREFIX}${bookStorageKey}.`;
}

export function isManagedBookCoverUrl(url: string | null | undefined): boolean {
	return typeof url === 'string' && url.startsWith(LIBRARY_COVER_ROUTE_PREFIX);
}

export function isValidManagedBookCoverFileName(fileName: string): boolean {
	return MANAGED_COVER_FILE_NAME_REGEX.test(fileName);
}

export class ManagedBookCoverService {
	private readonly serviceLogger = createChildLogger({ service: 'ManagedBookCoverService' });

	constructor(
		private readonly storage: StoragePort,
		private readonly fetchImpl: FetchLike = fetch,
		private readonly zlibraryBaseUrl = ZLIBRARY_BASE_URL
	) {}

	async storeFromSearchImport(
		input: StoreManagedBookCoverInput
	): Promise<ManagedBookCoverResult> {
		const sourceUrl = this.normalizeSourceUrl(input.provider, input.coverUrl);
		if (sourceUrl === null) {
			return { managedUrl: null, sourceUrl: null };
		}

		return this.storeFromNormalizedUrl({
			bookStorageKey: input.bookStorageKey,
			provider: input.provider,
			sourceUrl,
			fetchHeaders: this.buildFetchHeaders(input.provider, input.zlibraryCredentials, sourceUrl),
			responseUrlNormalizer: (url) => this.normalizeSourceUrl(input.provider, url)
		});
	}

	async storeFromExternalUrl(
		input: StoreExternalBookCoverInput
	): Promise<ManagedBookCoverResult> {
		const sourceUrl = this.normalizePublicExternalUrl(input.coverUrl);
		if (sourceUrl === null) {
			return { managedUrl: null, sourceUrl: null };
		}

		return this.storeFromNormalizedUrl({
			bookStorageKey: input.bookStorageKey,
			provider: 'manual',
			sourceUrl,
			fetchHeaders: this.buildDefaultFetchHeaders(),
			responseUrlNormalizer: (url) => this.normalizePublicExternalUrl(url)
		});
	}

	async storeFromBuffer(
		input: StoreManagedBookCoverBufferInput
	): Promise<ManagedBookCoverResult> {
		const contentType = normalizeContentType(input.contentType);
		if (contentType === null || !contentType.startsWith('image/')) {
			this.serviceLogger.warn(
				{
					event: 'library.cover.buffer.unsupported_content_type',
					bookStorageKey: input.bookStorageKey,
					contentType: input.contentType
				},
				'Managed cover buffer used an unsupported content type'
			);
			return { managedUrl: null, sourceUrl: null };
		}

		if (
			input.coverBuffer.byteLength === 0 ||
			input.coverBuffer.byteLength > MAX_MANAGED_BOOK_COVER_BYTES
		) {
			this.serviceLogger.warn(
				{
					event: 'library.cover.buffer.invalid_size',
					bookStorageKey: input.bookStorageKey,
					byteLength: input.coverBuffer.byteLength
				},
				'Managed cover buffer was empty or too large'
			);
			return { managedUrl: null, sourceUrl: null };
		}

		return this.uploadManagedCover({
			bookStorageKey: input.bookStorageKey,
			provider: 'epub',
			contentType,
			coverBuffer: input.coverBuffer,
			sourceUrl: null
		});
	}

	private async storeFromNormalizedUrl(input: {
		bookStorageKey: string;
		provider: SearchProviderId | 'manual';
		sourceUrl: string;
		fetchHeaders: Headers;
		responseUrlNormalizer: (url: string) => string | null;
	}): Promise<ManagedBookCoverResult> {
		try {
			const response = await this.fetchImpl(input.sourceUrl, {
				method: 'GET',
				headers: input.fetchHeaders
			});

			if (!response.ok) {
				this.serviceLogger.warn(
					{
						event: 'library.cover.fetch.rejected',
						bookStorageKey: input.bookStorageKey,
						provider: input.provider,
						sourceUrl: input.sourceUrl,
						status: response.status
					},
					'Managed cover fetch failed, falling back to source URL'
				);
				return { managedUrl: null, sourceUrl: input.sourceUrl };
			}

			const resolvedSourceUrl = input.responseUrlNormalizer(response.url);
			if (resolvedSourceUrl === null) {
				this.serviceLogger.warn(
					{
						event: 'library.cover.fetch.redirect_rejected',
						bookStorageKey: input.bookStorageKey,
						provider: input.provider,
						sourceUrl: input.sourceUrl,
						redirectUrl: response.url
					},
					'Managed cover fetch redirected to an untrusted URL'
				);
				return { managedUrl: null, sourceUrl: input.sourceUrl };
			}

			const contentType = normalizeContentType(response.headers.get('content-type'));
			if (contentType === null || !contentType.startsWith('image/')) {
				this.serviceLogger.warn(
					{
						event: 'library.cover.fetch.unsupported_content_type',
						bookStorageKey: input.bookStorageKey,
						provider: input.provider,
						sourceUrl: resolvedSourceUrl,
						contentType
					},
					'Managed cover fetch returned a non-image response'
				);
				return { managedUrl: null, sourceUrl: resolvedSourceUrl };
			}

			const declaredSize = parseDeclaredSize(response.headers.get('content-length'));
			if (declaredSize !== null && declaredSize > MAX_MANAGED_BOOK_COVER_BYTES) {
				this.serviceLogger.warn(
					{
						event: 'library.cover.fetch.too_large_declared',
						bookStorageKey: input.bookStorageKey,
						provider: input.provider,
						sourceUrl: resolvedSourceUrl,
						declaredSize
					},
					'Managed cover fetch exceeded the size limit before download'
				);
				return { managedUrl: null, sourceUrl: resolvedSourceUrl };
			}

			const extension = extensionFromImageContentType(contentType);
			if (extension === null) {
				this.serviceLogger.warn(
					{
						event: 'library.cover.fetch.unsupported_image_type',
						bookStorageKey: input.bookStorageKey,
						provider: input.provider,
						sourceUrl: resolvedSourceUrl,
						contentType
					},
					'Managed cover fetch returned an unsupported image type'
				);
				return { managedUrl: null, sourceUrl: resolvedSourceUrl };
			}

			const coverRead = await readResponseBufferWithinLimit({
				response,
				maxBytes: MAX_MANAGED_BOOK_COVER_BYTES
			});
			if (coverRead.exceededLimit || coverRead.byteLength === 0) {
				this.serviceLogger.warn(
					{
						event: 'library.cover.fetch.invalid_size',
						bookStorageKey: input.bookStorageKey,
						provider: input.provider,
						sourceUrl: resolvedSourceUrl,
						byteLength: coverRead.byteLength
					},
					'Managed cover fetch returned an empty or oversized payload'
				);
				return { managedUrl: null, sourceUrl: resolvedSourceUrl };
			}

			return this.uploadManagedCover({
				bookStorageKey: input.bookStorageKey,
				provider: input.provider,
				contentType,
				coverBuffer: coverRead.buffer,
				sourceUrl: resolvedSourceUrl
			});
		} catch (error: unknown) {
			this.serviceLogger.warn(
				{
					event: 'library.cover.fetch.failed',
					bookStorageKey: input.bookStorageKey,
					provider: input.provider,
					sourceUrl: input.sourceUrl,
					error: toLogError(error)
				},
				'Managed cover fetch failed, falling back to source URL'
			);
			return { managedUrl: null, sourceUrl: input.sourceUrl };
		}
	}

	private async uploadManagedCover(input: {
		bookStorageKey: string;
		provider: SearchProviderId | 'manual' | 'epub';
		contentType: string;
		coverBuffer: Buffer;
		sourceUrl: string | null;
	}): Promise<ManagedBookCoverResult> {
		const extension = extensionFromImageContentType(input.contentType);
		if (extension === null) {
			this.serviceLogger.warn(
				{
					event: 'library.cover.upload.unsupported_image_type',
					bookStorageKey: input.bookStorageKey,
					provider: input.provider,
					sourceUrl: input.sourceUrl,
					contentType: input.contentType
				},
				'Managed cover upload used an unsupported image type'
			);
			return { managedUrl: null, sourceUrl: input.sourceUrl };
		}

		try {
			const fileName = buildManagedBookCoverFileName(input.bookStorageKey, extension);
			await this.storage.put(
				buildManagedBookCoverStorageKey(fileName),
				input.coverBuffer,
				input.contentType
			);
			await this.deleteOtherManagedCovers(input.bookStorageKey, fileName);

			this.serviceLogger.info(
				{
					event: 'library.cover.uploaded',
					bookStorageKey: input.bookStorageKey,
					provider: input.provider,
					sourceUrl: input.sourceUrl,
					fileName,
					contentType: input.contentType,
					byteLength: input.coverBuffer.byteLength
				},
				'Managed cover uploaded to storage'
			);

			return {
				managedUrl: buildManagedBookCoverUrl(fileName),
				sourceUrl: input.sourceUrl
			};
		} catch (error: unknown) {
			this.serviceLogger.warn(
				{
					event: 'library.cover.upload.failed',
					bookStorageKey: input.bookStorageKey,
					provider: input.provider,
					sourceUrl: input.sourceUrl,
					contentType: input.contentType,
					error: toLogError(error)
				},
				'Managed cover upload failed'
			);
			return { managedUrl: null, sourceUrl: input.sourceUrl };
		}
	}

	private async deleteOtherManagedCovers(bookStorageKey: string, keepFileName: string): Promise<void> {
		try {
			const objects = await this.storage.list(buildManagedBookCoverPrefix(bookStorageKey));
			const keepKey = buildManagedBookCoverStorageKey(keepFileName);
			for (const object of objects) {
				if (object.key === keepKey) {
					continue;
				}
				try {
					await this.storage.delete(object.key);
				} catch (error: unknown) {
					this.serviceLogger.warn(
						{
							event: 'library.cover.delete.failed',
							bookStorageKey,
							coverKey: object.key,
							error: toLogError(error)
						},
						'Managed cover delete failed, continuing'
					);
				}
			}
		} catch (error: unknown) {
			this.serviceLogger.warn(
				{
					event: 'library.cover.list.failed',
					bookStorageKey,
					error: toLogError(error)
				},
				'Managed cover lookup failed, continuing'
			);
		}
	}

	async deleteForBookStorageKey(bookStorageKey: string): Promise<void> {
		try {
			const objects = await this.storage.list(buildManagedBookCoverPrefix(bookStorageKey));
			for (const object of objects) {
				try {
					await this.storage.delete(object.key);
				} catch (error: unknown) {
					this.serviceLogger.warn(
						{
							event: 'library.cover.delete.failed',
							bookStorageKey,
							coverKey: object.key,
							error: toLogError(error)
						},
						'Managed cover delete failed, continuing'
					);
				}
			}
		} catch (error: unknown) {
			this.serviceLogger.warn(
				{
					event: 'library.cover.list.failed',
					bookStorageKey,
					error: toLogError(error)
				},
				'Managed cover lookup failed, continuing'
			);
		}
	}

	private normalizeSourceUrl(
		provider: SearchProviderId,
		coverUrl: string | null | undefined
	): string | null {
		const normalized = typeof coverUrl === 'string' ? coverUrl.trim() : '';
		if (!normalized) {
			return null;
		}

		if (provider === 'gutenberg') {
			return null;
		}

		if (provider === 'openlibrary') {
			const url = parseUrl(normalized);
			if (url === null || url.protocol !== 'https:' || url.hostname !== OPEN_LIBRARY_COVER_HOST) {
				return null;
			}
			return url.toString();
		}

		if (provider === 'anna') {
			const url = parseUrl(normalized);
			if (url === null || url.protocol !== 'https:') {
				return null;
			}
			if (
				url.hostname !== ANNA_ARCHIVE_COVER_HOST &&
				url.hostname !== OPEN_LIBRARY_COVER_HOST
			) {
				return null;
			}
			return url.toString();
		}

		if (provider === 'zlibrary') {
			const baseUrl = parseUrl(this.zlibraryBaseUrl);
			if (baseUrl === null) {
				return null;
			}

			let url = parseUrl(normalized);
			if (url === null) {
				try {
					url = new URL(normalized, baseUrl);
				} catch {
					return null;
				}
			}

			if (url === null || url.protocol !== 'https:') {
				return null;
			}
			return url.toString();
		}

		return null;
	}

	private normalizePublicExternalUrl(coverUrl: string | null | undefined): string | null {
		const normalized = typeof coverUrl === 'string' ? coverUrl.trim() : '';
		if (!normalized) {
			return null;
		}

		const url = parseProtocolRelativeOrAbsoluteUrl(normalized);
		if (
			url === null ||
			(url.protocol !== 'https:' && url.protocol !== 'http:') ||
			isBlockedManualImportHostname(url.hostname)
		) {
			return null;
		}

		return url.toString();
	}

	private buildDefaultFetchHeaders(): Headers {
		return new Headers({
			Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
			'User-Agent': DEFAULT_USER_AGENT
		});
	}

	private buildFetchHeaders(
		provider: SearchProviderId,
		zlibraryCredentials: ZLibraryCredentials | undefined,
		targetUrl: string
	): Headers {
		const headers = this.buildDefaultFetchHeaders();

		const baseUrl = parseUrl(this.zlibraryBaseUrl);
		const requestUrl = parseUrl(targetUrl);
		if (
			provider === 'zlibrary' &&
			zlibraryCredentials &&
			baseUrl !== null &&
			requestUrl !== null &&
			requestUrl.hostname === baseUrl.hostname
		) {
			headers.set('Cookie', buildZLibraryCookie(zlibraryCredentials));
		}

		return headers;
	}
}
