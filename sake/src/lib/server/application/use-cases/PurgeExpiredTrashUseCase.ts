import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import { apiOk, type ApiResult } from '$lib/server/http/api';

interface PurgeExpiredTrashResult {
	success: true;
	purgedBookIds: number[];
}

export class PurgeExpiredTrashUseCase {
	constructor(
		private readonly bookRepository: BookRepositoryPort,
		private readonly storage: StoragePort
	) {}

	async execute(nowIso = new Date().toISOString()): Promise<ApiResult<PurgeExpiredTrashResult>> {
		const expiredBooks = await this.bookRepository.getExpiredTrash(nowIso);
		const purgedBookIds: number[] = [];

		for (const book of expiredBooks) {
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

			await this.bookRepository.delete(book.id);
			purgedBookIds.push(book.id);
		}

		return apiOk({ success: true, purgedBookIds });
	}
}
