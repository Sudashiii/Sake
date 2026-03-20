import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import { ManagedBookCoverService } from '$lib/server/application/services/ManagedBookCoverService';
import { apiOk, type ApiResult } from '$lib/server/http/api';

interface PurgeExpiredTrashResult {
	success: true;
	purgedBookIds: number[];
}

export class PurgeExpiredTrashUseCase {
	constructor(
		private readonly bookRepository: BookRepositoryPort,
		private readonly storage: StoragePort,
		private readonly managedBookCoverService: ManagedBookCoverService = new ManagedBookCoverService(storage)
	) {}

	async execute(nowIso = new Date().toISOString()): Promise<ApiResult<PurgeExpiredTrashResult>> {
		const expiredBooks = await this.bookRepository.getExpiredTrash(nowIso);
		const externallyReferencedStorageKeys = new Set(
			await this.bookRepository.listStorageKeysWithExternalReferences(
				expiredBooks.map((book) => book.s3_storage_key),
				expiredBooks.map((book) => book.id)
			)
		);
		const cleanedStorageKeys = new Set<string>();
		const purgedBookIds: number[] = [];

		for (const book of expiredBooks) {
			const shouldCleanStorage =
				!externallyReferencedStorageKeys.has(book.s3_storage_key) &&
				!cleanedStorageKeys.has(book.s3_storage_key);
			if (shouldCleanStorage) {
				try {
					await this.storage.delete(`library/${book.s3_storage_key}`);
				} catch {
					// Ignore missing file/object during purge.
				}

				if (book.progress_storage_key) {
					try {
						await this.storage.delete(`library/${book.progress_storage_key}`);
					} catch {
						// Ignore missing progress object during purge.
					}
				}

				await this.managedBookCoverService.deleteForBookStorageKey(book.s3_storage_key);
				cleanedStorageKeys.add(book.s3_storage_key);
			}

			await this.bookRepository.delete(book.id);
			purgedBookIds.push(book.id);
		}

		return apiOk({ success: true, purgedBookIds });
	}
}
