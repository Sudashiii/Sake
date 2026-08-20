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
import type { ReaderAnnotation } from '$lib/koreader/koreaderSidecar';
import { EMPTY_ANNOTATION_QUERY } from '$lib/types/Annotations/Annotation';
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
const { AnnotationRepository } = await import('$lib/server/infrastructure/repositories/AnnotationRepository');

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
	let annotationRepository: InstanceType<typeof AnnotationRepository>;
	let client: ReturnType<typeof createClient>;

	before(async () => {
		client = createClient({ url: `file:${databasePath}` });
		await migrate(drizzle(client), { migrationsFolder: new URL('../../../drizzle', import.meta.url).pathname });
		repository = new BookRepository();
		annotationRepository = new AnnotationRepository();
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

	test('keeps annotation ids stable across projection replacement and cascades deletion', async () => {
		const created = await repository.create({ ...book, s3_storage_key: 'annotation.epub', title: 'Annotation Book' });
		await repository.updateProgress(created.id, 'annotation.sdr/metadata.epub.lua', 0.5, '2026-08-16T10:00:00.000Z');
		const annotation: ReaderAnnotation = {
			id: 'source-1', kind: 'highlight', page: '/body/p', pos0: '/body/p', pos1: '/body/p.4',
			text: 'Needle passage', note: 'Needle note', chapter: 'Chapter One', color: 'yellow',
			datetime: '2026-08-16 10:00:00'
		};
		await annotationRepository.replaceForBook({
			bookId: created.id,
			annotations: [annotation],
			sourceProgressUpdatedAt: '2026-08-16T10:00:00.000Z',
			parserVersion: 1
		});
		const first = await annotationRepository.list({ ...EMPTY_ANNOTATION_QUERY, q: 'needle' }, null);
		assert.equal(first.items.length, 1);
		const annotationId = first.items[0].id;
		await annotationRepository.replaceForBook({
			bookId: created.id,
			annotations: [{ ...annotation, note: 'Updated' }],
			sourceProgressUpdatedAt: '2026-08-16T11:00:00.000Z',
			parserVersion: 1
		});
		assert.equal((await annotationRepository.getById(annotationId))?.note, 'Updated');
		await repository.delete(created.id);
		assert.equal(await annotationRepository.getById(annotationId), undefined);
	});

	test('treats matching null progress timestamps as an indexed projection', async () => {
		const created = await repository.create({ ...book, s3_storage_key: 'null-progress.epub', title: 'Null progress' });
		await repository.updateProgress(created.id, 'null-progress.sdr/metadata.epub.lua', 0.5);
		await client.execute({
			sql: 'UPDATE Books SET progress_updated_at = NULL WHERE id = ?',
			args: [created.id]
		});
		await annotationRepository.replaceForBook({
			bookId: created.id,
			annotations: [],
			sourceProgressUpdatedAt: null,
			parserVersion: 1
		});

		const summary = await annotationRepository.getIndexSummary(1);
		assert.equal(summary.indexedBooks, 1);
		assert.equal(summary.pendingBooks, 0);
		assert.deepEqual(await annotationRepository.listIndexCandidates(1, created.id), []);
		await repository.delete(created.id);
	});
});
