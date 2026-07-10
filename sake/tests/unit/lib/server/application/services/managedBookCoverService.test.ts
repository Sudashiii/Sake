import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	buildManagedBookCoverVersionToken,
	buildVersionedManagedBookCoverUrl,
	ManagedBookCoverService,
	MIN_MANAGED_BOOK_COVER_BYTES,
	MAX_MANAGED_BOOK_COVER_BYTES
} from '$lib/server/application/services/ManagedBookCoverService';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
	return Uint8Array.from(buffer).buffer as ArrayBuffer;
}

function createImageBuffer(contentType: string, fill = 1): Buffer {
	const buffer = Buffer.alloc(MIN_MANAGED_BOOK_COVER_BYTES, fill);
	switch (contentType) {
		case 'image/jpeg':
			buffer.set([0xff, 0xd8, 0xff], 0);
			break;
		case 'image/png':
			buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
			break;
		case 'image/gif':
			buffer.write('GIF89a', 0, 'ascii');
			break;
		case 'image/webp':
			buffer.write('RIFF', 0, 'ascii');
			buffer.write('WEBP', 8, 'ascii');
			break;
		case 'image/avif':
			buffer.write('ftyp', 4, 'ascii');
			buffer.write('avif', 8, 'ascii');
			break;
		default:
			throw new Error(`Unsupported test image content type: ${contentType}`);
	}
	return buffer;
}

function createResponse(input: {
	url: string;
	status?: number;
	headers?: Record<string, string>;
	body?: Buffer;
	bodyChunks?: Buffer[];
}): Response {
	const chunks = input.bodyChunks ?? [input.body ?? Buffer.alloc(0)];
	const body = Buffer.concat(chunks);
	return {
		ok: (input.status ?? 200) >= 200 && (input.status ?? 200) < 300,
		status: input.status ?? 200,
		url: input.url,
		headers: new Headers(input.headers),
		body: new ReadableStream<Uint8Array>({
			start(controller) {
				for (const chunk of chunks) {
					controller.enqueue(Uint8Array.from(chunk));
				}
				controller.close();
			}
		}),
		async arrayBuffer(): Promise<ArrayBuffer> {
			return toArrayBuffer(body);
		}
	} as unknown as Response;
}

describe('ManagedBookCoverService', () => {
	test('downloads trusted OpenLibrary covers into managed storage', async () => {
		const coverBuffer = createImageBuffer('image/jpeg');
		const stored: Array<{
			key: string;
			body: Buffer | Uint8Array | NodeJS.ReadableStream;
			contentType?: string;
		}> = [];

		const storage = {
			async put(key, body, contentType): Promise<void> {
				stored.push({ key, body, contentType });
			},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {},
			async list(): Promise<[]> {
				return [];
			}
		} as StoragePort;

		const service = new ManagedBookCoverService(storage, async (input) => {
			assert.equal(input, 'https://covers.openlibrary.org/b/id/123-L.jpg');
			return createResponse({
				url: 'https://covers.openlibrary.org/b/id/123-L.jpg',
				headers: {
					'content-type': 'image/jpeg',
					'content-length': String(coverBuffer.byteLength)
				},
				body: coverBuffer
			});
		});

		const result = await service.storeFromSearchImport({
			bookStorageKey: 'example.epub',
			provider: 'openlibrary',
			coverUrl: 'https://covers.openlibrary.org/b/id/123-L.jpg'
		});

		assert.deepEqual(result, {
			managedUrl: buildVersionedManagedBookCoverUrl(
				'example.epub.jpg',
				buildManagedBookCoverVersionToken(coverBuffer)
			),
			sourceUrl: 'https://covers.openlibrary.org/b/id/123-L.jpg'
		});
		assert.equal(stored.length, 1);
		assert.equal(stored[0]?.key, 'covers/example.epub.jpg');
		assert.equal(stored[0]?.contentType, 'image/jpeg');
		assert.deepEqual(Buffer.from(stored[0]?.body as Buffer), coverBuffer);
	});

	test('skips untrusted source URLs before fetch', async () => {
		let fetchCalls = 0;

		const storage = {
			async put(): Promise<void> {
				throw new Error('should not upload');
			},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {},
			async list(): Promise<[]> {
				return [];
			}
		} as StoragePort;

		const service = new ManagedBookCoverService(storage, async () => {
			fetchCalls += 1;
			throw new Error('should not fetch');
		});

		const result = await service.storeFromSearchImport({
			bookStorageKey: 'example.epub',
			provider: 'openlibrary',
			coverUrl: 'https://example.com/cover.jpg'
		});

		assert.deepEqual(result, { managedUrl: null, sourceUrl: null });
		assert.equal(fetchCalls, 0);
	});

	test('falls back to the source URL when the response is not an image', async () => {
		const storage = {
			async put(): Promise<void> {
				throw new Error('should not upload');
			},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {},
			async list(): Promise<[]> {
				return [];
			}
		} as StoragePort;

		const service = new ManagedBookCoverService(storage, async () =>
			createResponse({
				url: 'https://covers.openlibrary.org/b/id/123-L.jpg',
				headers: {
					'content-type': 'text/html'
				},
				body: Buffer.from('oops')
			})
		);

		const result = await service.storeFromSearchImport({
			bookStorageKey: 'example.epub',
			provider: 'openlibrary',
			coverUrl: 'https://covers.openlibrary.org/b/id/123-L.jpg'
		});

		assert.deepEqual(result, {
			managedUrl: null,
			sourceUrl: 'https://covers.openlibrary.org/b/id/123-L.jpg'
		});
	});

	test('falls back when a streamed cover response exceeds the size limit without content-length', async () => {
		let putCalls = 0;

		const storage = {
			async put(): Promise<void> {
				putCalls += 1;
			},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {},
			async list(): Promise<[]> {
				return [];
			}
		} as StoragePort;

		const service = new ManagedBookCoverService(storage, async () =>
			createResponse({
				url: 'https://books.google.com/books/content?id=test-cover',
				headers: {
					'content-type': 'image/jpeg'
				},
				bodyChunks: [
					Buffer.alloc(MAX_MANAGED_BOOK_COVER_BYTES - 4, 1),
					Buffer.alloc(8, 2)
				]
			})
		);

		const result = await service.storeFromExternalUrl({
			bookStorageKey: 'example.epub',
			coverUrl: 'https://books.google.com/books/content?id=test-cover'
		});

		assert.deepEqual(result, {
			managedUrl: null,
			sourceUrl: 'https://books.google.com/books/content?id=test-cover'
		});
		assert.equal(putCalls, 0);
	});

	test('falls back when a fetched cover is smaller than the minimum size', async () => {
		let putCalls = 0;

		const storage = {
			async put(): Promise<void> {
				putCalls += 1;
			},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {},
			async list(): Promise<[]> {
				return [];
			}
		} as StoragePort;

		const service = new ManagedBookCoverService(storage, async () =>
			createResponse({
				url: 'https://books.google.com/books/content?id=test-cover',
				headers: {
					'content-type': 'image/jpeg'
				},
				body: Buffer.from([0xff, 0xd8, 0xff])
			})
		);

		const result = await service.storeFromExternalUrl({
			bookStorageKey: 'example.epub',
			coverUrl: 'https://books.google.com/books/content?id=test-cover'
		});

		assert.deepEqual(result, {
			managedUrl: null,
			sourceUrl: 'https://books.google.com/books/content?id=test-cover'
		});
		assert.equal(putCalls, 0);
	});

	test('falls back when fetched cover bytes do not match the declared image type', async () => {
		let putCalls = 0;

		const storage = {
			async put(): Promise<void> {
				putCalls += 1;
			},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {},
			async list(): Promise<[]> {
				return [];
			}
		} as StoragePort;

		const service = new ManagedBookCoverService(storage, async () =>
			createResponse({
				url: 'https://books.google.com/books/content?id=test-cover',
				headers: {
					'content-type': 'image/jpeg'
				},
				body: Buffer.alloc(MIN_MANAGED_BOOK_COVER_BYTES, 7)
			})
		);

		const result = await service.storeFromExternalUrl({
			bookStorageKey: 'example.epub',
			coverUrl: 'https://books.google.com/books/content?id=test-cover'
		});

		assert.deepEqual(result, {
			managedUrl: null,
			sourceUrl: 'https://books.google.com/books/content?id=test-cover'
		});
		assert.equal(putCalls, 0);
	});

	test('normalizes relative Z-Library covers and forwards auth cookies', async () => {
		let requestHeaders: Headers | null = null;
		const coverBuffer = createImageBuffer('image/webp', 4);

		const storage = {
			async put(): Promise<void> {},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {},
			async list(): Promise<[]> {
				return [];
			}
		} as StoragePort;

		const service = new ManagedBookCoverService(storage, async (input, init) => {
			assert.equal(input, 'https://1lib.sk/covers/books/123.webp');
			requestHeaders = init?.headers as Headers;
			return createResponse({
				url: 'https://1lib.sk/covers/books/123.webp',
				headers: {
					'content-type': 'image/webp'
				},
				body: coverBuffer
			});
		});

		const result = await service.storeFromSearchImport({
			bookStorageKey: 'example.epub',
			provider: 'zlibrary',
			coverUrl: '/covers/books/123.webp',
			zlibraryCredentials: {
				userId: 'user-1',
				userKey: 'key-1'
			}
		});

		assert.deepEqual(result, {
			managedUrl: buildVersionedManagedBookCoverUrl(
				'example.epub.webp',
				buildManagedBookCoverVersionToken(coverBuffer)
			),
			sourceUrl: 'https://1lib.sk/covers/books/123.webp'
		});
		if (requestHeaders === null) {
			throw new Error('Expected Z-Library cover request headers');
		}
		const headers = requestHeaders as Headers;
		assert.match(headers.get('Cookie') ?? '', /remix_userid=user-1/);
		assert.match(headers.get('Cookie') ?? '', /remix_userkey=key-1/);
	});

	test('accepts protocol-relative Z-Library CDN cover URLs without leaking auth cookies', async () => {
		let requestHeaders: Headers | null = null;
		const coverBuffer = createImageBuffer('image/jpeg', 7);

		const storage = {
			async put(): Promise<void> {},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {},
			async list(): Promise<[]> {
				return [];
			}
		} as StoragePort;

		const service = new ManagedBookCoverService(storage, async (input, init) => {
			assert.equal(input, 'https://cdn.example.com/covers/books/123.jpg');
			requestHeaders = init?.headers as Headers;
			return createResponse({
				url: 'https://cdn.example.com/covers/books/123.jpg',
				headers: {
					'content-type': 'image/jpeg'
				},
				body: coverBuffer
			});
		});

		const result = await service.storeFromSearchImport({
			bookStorageKey: 'example.epub',
			provider: 'zlibrary',
			coverUrl: '//cdn.example.com/covers/books/123.jpg',
			zlibraryCredentials: {
				userId: 'user-1',
				userKey: 'key-1'
			}
		});

		assert.deepEqual(result, {
			managedUrl: buildVersionedManagedBookCoverUrl(
				'example.epub.jpg',
				buildManagedBookCoverVersionToken(coverBuffer)
			),
			sourceUrl: 'https://cdn.example.com/covers/books/123.jpg'
		});
		if (requestHeaders === null) {
			throw new Error('Expected Z-Library CDN request headers');
		}
		const headers = requestHeaders as Headers;
		assert.equal(headers.get('Cookie'), null);
	});

	test('imports arbitrary external HTTPS cover URLs for manual library metadata actions', async () => {
		let requestedUrl: string | null = null;
		const coverBuffer = createImageBuffer('image/jpeg', 9);

		const storage = {
			async put(): Promise<void> {},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {},
			async list(): Promise<[]> {
				return [];
			}
		} as StoragePort;

		const service = new ManagedBookCoverService(storage, async (input) => {
			requestedUrl = String(input);
			return createResponse({
				url: 'https://books.google.com/books/content?id=test-cover',
				headers: {
					'content-type': 'image/jpeg'
				},
				body: coverBuffer
			});
		});

		const result = await service.storeFromExternalUrl({
			bookStorageKey: 'example.epub',
			coverUrl: 'https://books.google.com/books/content?id=test-cover'
		});

		assert.equal(requestedUrl, 'https://books.google.com/books/content?id=test-cover');
		assert.deepEqual(result, {
			managedUrl: buildVersionedManagedBookCoverUrl(
				'example.epub.jpg',
				buildManagedBookCoverVersionToken(coverBuffer)
			),
			sourceUrl: 'https://books.google.com/books/content?id=test-cover'
		});
	});

	test('imports arbitrary external HTTP cover URLs for manual library metadata actions', async () => {
		let requestedUrl: string | null = null;
		const coverBuffer = createImageBuffer('image/jpeg', 8);

		const storage = {
			async put(): Promise<void> {},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {},
			async list(): Promise<[]> {
				return [];
			}
		} as StoragePort;

		const service = new ManagedBookCoverService(storage, async (input) => {
			requestedUrl = String(input);
			return createResponse({
				url: 'http://books.google.com/books/content?id=test-cover',
				headers: {
					'content-type': 'image/jpeg'
				},
				body: coverBuffer
			});
		});

		const result = await service.storeFromExternalUrl({
			bookStorageKey: 'example.epub',
			coverUrl: 'http://books.google.com/books/content?id=test-cover'
		});

		assert.equal(requestedUrl, 'http://books.google.com/books/content?id=test-cover');
		assert.deepEqual(result, {
			managedUrl: buildVersionedManagedBookCoverUrl(
				'example.epub.jpg',
				buildManagedBookCoverVersionToken(coverBuffer)
			),
			sourceUrl: 'http://books.google.com/books/content?id=test-cover'
		});
	});

	test('stores embedded cover buffers into managed storage', async () => {
		const coverBuffer = createImageBuffer('image/png');
		const stored: Array<{
			key: string;
			body: Buffer | Uint8Array | NodeJS.ReadableStream;
			contentType?: string;
		}> = [];

		const storage = {
			async put(key, body, contentType): Promise<void> {
				stored.push({ key, body, contentType });
			},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {},
			async list(): Promise<[]> {
				return [];
			}
		} as StoragePort;

		const service = new ManagedBookCoverService(storage);
		const result = await service.storeFromBuffer({
			bookStorageKey: 'example.epub',
			coverBuffer,
			contentType: 'image/png'
		});

		assert.deepEqual(result, {
			managedUrl: buildVersionedManagedBookCoverUrl(
				'example.epub.png',
				buildManagedBookCoverVersionToken(coverBuffer)
			),
			sourceUrl: null
		});
		assert.equal(stored.length, 1);
		assert.equal(stored[0]?.key, 'covers/example.epub.png');
		assert.equal(stored[0]?.contentType, 'image/png');
		assert.deepEqual(Buffer.from(stored[0]?.body as Buffer), coverBuffer);
	});

	test('rejects embedded cover buffers with unsupported content types', async () => {
		const storage = {
			async put(): Promise<void> {
				throw new Error('should not upload');
			},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {},
			async list(): Promise<[]> {
				return [];
			}
		} as StoragePort;

		const service = new ManagedBookCoverService(storage);
		const result = await service.storeFromBuffer({
			bookStorageKey: 'example.epub',
			coverBuffer: createImageBuffer('image/png'),
			contentType: 'image/svg+xml'
		});

		assert.deepEqual(result, {
			managedUrl: null,
			sourceUrl: null
		});
	});

	test('rejects embedded cover buffers that are too small or have an invalid signature', async () => {
		const storage = {
			async put(): Promise<void> {
				throw new Error('should not upload');
			},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {},
			async list(): Promise<[]> {
				return [];
			}
		} as StoragePort;

		const service = new ManagedBookCoverService(storage);

		assert.deepEqual(
			await service.storeFromBuffer({
				bookStorageKey: 'example.epub',
				coverBuffer: Buffer.from([0xff, 0xd8, 0xff]),
				contentType: 'image/jpeg'
			}),
			{ managedUrl: null, sourceUrl: null }
		);

		assert.deepEqual(
			await service.storeFromBuffer({
				bookStorageKey: 'example.epub',
				coverBuffer: Buffer.alloc(MIN_MANAGED_BOOK_COVER_BYTES, 1),
				contentType: 'image/jpeg'
			}),
			{ managedUrl: null, sourceUrl: null }
		);
	});

	test('returns a fresh managed URL when replacing a cover with the same file extension', async () => {
		const storedKeys: string[] = [];

		const storage = {
			async put(key: string): Promise<void> {
				storedKeys.push(key);
			},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {},
			async list(): Promise<[]> {
				return [];
			}
		} as StoragePort;

		const service = new ManagedBookCoverService(storage);
		const firstBuffer = createImageBuffer('image/jpeg', 3);
		const secondBuffer = createImageBuffer('image/jpeg', 6);
		const first = await service.storeFromBuffer({
			bookStorageKey: 'example.epub',
			coverBuffer: firstBuffer,
			contentType: 'image/jpeg'
		});
		const second = await service.storeFromBuffer({
			bookStorageKey: 'example.epub',
			coverBuffer: secondBuffer,
			contentType: 'image/jpeg'
		});

		assert.equal(first.managedUrl?.startsWith('/api/library/covers/example.epub.jpg?v='), true);
		assert.equal(second.managedUrl?.startsWith('/api/library/covers/example.epub.jpg?v='), true);
		assert.notEqual(first.managedUrl, second.managedUrl);
		assert.deepEqual(storedKeys, ['covers/example.epub.jpg', 'covers/example.epub.jpg']);
	});

	test('rejects localhost-style manual cover imports', async () => {
		const storage = {
			async put(): Promise<void> {
				throw new Error('should not upload');
			},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(): Promise<void> {},
			async list(): Promise<[]> {
				return [];
			}
		} as StoragePort;

		const service = new ManagedBookCoverService(storage);
		const result = await service.storeFromExternalUrl({
			bookStorageKey: 'example.epub',
			coverUrl: 'https://localhost/private-cover.jpg'
		});

		assert.deepEqual(result, {
			managedUrl: null,
			sourceUrl: null
		});
	});

	test('deletes all managed covers for a book storage key', async () => {
		let listedPrefix: string | null = null;
		const deletedKeys: string[] = [];

		const storage = {
			async put(): Promise<void> {
				throw new Error('not implemented');
			},
			async get(): Promise<Buffer> {
				throw new Error('not implemented');
			},
			async delete(key: string): Promise<void> {
				deletedKeys.push(key);
			},
			async list(prefix: string): Promise<Array<{ key: string; size: number }>> {
				listedPrefix = prefix;
				return [
					{ key: 'covers/example.epub.jpg', size: 3 },
					{ key: 'covers/example.epub.webp', size: 5 }
				];
			}
		} as StoragePort;

		const service = new ManagedBookCoverService(storage);
		await service.deleteForBookStorageKey('example.epub');

		assert.equal(listedPrefix, 'covers/example.epub.');
		assert.deepEqual(deletedKeys, ['covers/example.epub.jpg', 'covers/example.epub.webp']);
	});
});
