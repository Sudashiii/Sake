import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import { GetLibraryBookContentUseCase } from '$lib/server/application/use-cases/GetLibraryBookContentUseCase';
import type { Book } from '$lib/server/domain/entities/Book';

function book(extension: string | null): Book {
	return {
		id: 7,
		zLibId: null,
		s3_storage_key: 'Fixture.epub',
		title: 'Fixture',
		author: null,
		publisher: null,
		series: null,
		volume: null,
		series_index: null,
		edition: null,
		identifier: null,
		pages: null,
		description: null,
		google_books_id: null,
		open_library_key: null,
		amazon_asin: null,
		external_rating: null,
		external_rating_count: null,
		cover: null,
		extension,
		filesize: null,
		language: null,
		year: null,
		month: null,
		day: null,
		progress_storage_key: null,
		progress_updated_at: null,
		progress_percent: null,
		progress_before_read: null,
		rating: null,
		read_at: null,
		archived_at: null,
		exclude_from_new_books: false,
		createdAt: null,
		deleted_at: null,
		trash_expires_at: null
	};
}

describe('GetLibraryBookContentUseCase', () => {
	test('loads an active EPUB by its database id and storage key', async () => {
		let fetchedKey = '';
		const useCase = new GetLibraryBookContentUseCase(
			{
				async getById() {
					return book('epub');
				}
			} as unknown as BookRepositoryPort,
			{
				async get(key) {
					fetchedKey = key;
					return Buffer.from('epub bytes');
				}
			} as StoragePort
		);

		const result = await useCase.execute(7);
		assert.equal(result.ok, true);
		if (!result.ok) {
			return;
		}
		assert.equal(fetchedKey, 'library/Fixture.epub');
		assert.equal(result.value.fileName, 'Fixture.epub');
		assert.equal(Buffer.from(result.value.data).toString(), 'epub bytes');
	});

	test('rejects non-EPUB books', async () => {
		const useCase = new GetLibraryBookContentUseCase(
			{
				async getById() {
					return book('pdf');
				}
			} as unknown as BookRepositoryPort,
			{} as StoragePort
		);

		const result = await useCase.execute(7);
		assert.equal(result.ok, false);
		if (!result.ok) {
			assert.equal(result.error.status, 415);
		}
	});
});
