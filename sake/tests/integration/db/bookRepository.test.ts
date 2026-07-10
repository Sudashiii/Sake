import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import type { CreateBookInput } from '$lib/server/domain/entities/Book';
// @ts-expect-error Bun's test-only mock API is available at runtime but excluded from the app tsconfig.
import { mock } from 'bun:test';

const databasePath = join(tmpdir(), `sake-repository-${process.pid}-${randomUUID()}.db`);
process.env.LIBSQL_URL = `file:${databasePath}`;
process.env.LIBSQL_AUTH_TOKEN = '';
// BookRepository creates the shared database client through the full infrastructure
// configuration. These values keep the database-only test independent from pipeline
// secrets; no S3 request is made by this suite.
process.env.S3_ENDPOINT = 'http://s3.integration.test';
process.env.S3_REGION = 'us-east-1';
process.env.S3_BUCKET = 'integration-test';
process.env.S3_ACCESS_KEY_ID = 'integration-test';
process.env.S3_SECRET_ACCESS_KEY = 'integration-test';
process.env.S3_FORCE_PATH_STYLE = 'true';

mock.module('$env/dynamic/private', () => ({ env: process.env }));
const { BookRepository } = await import('$lib/server/infrastructure/repositories/BookRepository');

const book: CreateBookInput = {
	zLibId: null,
	s3_storage_key: 'library/integration.epub',
	title: 'Integration Book',
	author: 'Test Author',
	publisher: null,
	series: null,
	volume: null,
	series_index: null,
	edition: null,
	identifier: 'integration-1',
	pages: 100,
	description: null,
	google_books_id: null,
	open_library_key: null,
	hardcover_id: null,
	amazon_asin: null,
	external_rating: null,
	external_rating_count: null,
	cover: null,
	extension: 'epub',
	filesize: 123,
	language: 'en',
	year: 2026,
	month: 7,
	day: 10
};

describe('BookRepository with a migrated libSQL database', () => {
	let repository: InstanceType<typeof BookRepository>;

	before(async () => {
		const client = createClient({ url: `file:${databasePath}` });
		await migrate(drizzle(client), { migrationsFolder: new URL('../../../drizzle', import.meta.url).pathname });
		repository = new BookRepository();
	});

	after(async () => {
		await rm(databasePath, { force: true });
	});

	test('persists, reads, updates, and deletes a book through the concrete repository', async () => {
		const created = await repository.create(book);
		assert.equal(created.title, book.title);
		assert.equal((await repository.getById(created.id))?.s3_storage_key, book.s3_storage_key);

		await repository.updateRating(created.id, 5);
		await repository.updateProgress(created.id, 'progress/integration.lua', 1, '2026-07-10T00:00:00.000Z');
		const updated = await repository.getById(created.id);
		assert.equal(updated?.rating, 5);
		assert.equal(updated?.progress_percent, 1);
		assert.equal(updated?.read_at, '2026-07-10T00:00:00.000Z');

		await repository.delete(created.id);
		assert.equal(await repository.getByIdIncludingTrashed(created.id), undefined);
	});

	test('keeps trashed rows available to explicit queries but out of active listings', async () => {
		const created = await repository.create({ ...book, s3_storage_key: 'library/trashed.epub' });
		await repository.moveToTrash(created.id, '2026-07-10T00:00:00.000Z', '2026-08-10T00:00:00.000Z');

		assert.equal(await repository.getById(created.id), undefined);
		assert.equal((await repository.getByIdIncludingTrashed(created.id))?.deleted_at, '2026-07-10T00:00:00.000Z');
		assert.equal((await repository.getAll()).some((entry) => entry.id === created.id), false);
		await repository.delete(created.id);
	});
});
