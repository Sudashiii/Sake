import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { describe, test } from 'node:test';
import { S3ServiceException, type S3Client } from '@aws-sdk/client-s3';
// @ts-expect-error Bun's test-only mock API is available at runtime but excluded from the app tsconfig.
import { mock } from 'bun:test';

mock.module('$env/dynamic/private', () => ({ env: process.env }));
const { S3Storage } = await import('$lib/server/infrastructure/storage/S3Storage');

type CommandInput = { input: Record<string, unknown>; constructor: { name: string } };

describe('S3Storage boundary', () => {
	test('maps object operations and paginated listing through the S3 command contract', async () => {
		const objects = new Map<string, Buffer>();
		const fakeClient = {
			send: async (command: unknown) => {
				const { input, constructor } = command as CommandInput;
				const key = String(input.Key ?? '');

				switch (constructor.name) {
					case 'PutObjectCommand':
						objects.set(key, Buffer.from(input.Body as Uint8Array));
						return {};
					case 'GetObjectCommand':
						return { Body: Readable.from([objects.get(key) ?? Buffer.from('')]) };
					case 'HeadObjectCommand':
						if (objects.has(key)) return {};
						throw new S3ServiceException({
							name: 'NotFound',
							message: 'not found',
							$fault: 'client',
							$metadata: { httpStatusCode: 404 }
						});
					case 'DeleteObjectCommand':
						objects.delete(key);
						return {};
					case 'ListObjectsV2Command':
						return {
							Contents: [...objects.entries()].map(([objectKey, body]) => ({ Key: objectKey, Size: body.length }))
						};
					default:
						throw new Error(`Unexpected S3 command: ${constructor.name}`);
				}
			}
		} as unknown as S3Client;

		const storage = new S3Storage(fakeClient, 'test-bucket');
		await storage.put('library/book.epub', Buffer.from('book'), 'application/epub+zip');
		assert.deepEqual(await storage.get('library/book.epub'), Buffer.from('book'));
		assert.equal(await storage.exists('library/book.epub'), true);
		assert.deepEqual(await storage.list('library/'), [{ key: 'library/book.epub', size: 4, lastModified: undefined }]);

		await storage.delete('library/book.epub');
		assert.equal(await storage.exists('library/book.epub'), false);
	});
});
