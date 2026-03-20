import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import { ManagedBookCoverService } from '$lib/server/application/services/ManagedBookCoverService';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface DeleteTrashedLibraryBookInput {
	bookId: number;
}

interface DeleteTrashedLibraryBookResult {
	success: true;
	bookId: number;
}

export class DeleteTrashedLibraryBookUseCase {
	constructor(
		private readonly bookRepository: BookRepositoryPort,
		private readonly storage: StoragePort,
		private readonly managedBookCoverService: ManagedBookCoverService = new ManagedBookCoverService(storage)
	) {}

	async execute(input: DeleteTrashedLibraryBookInput): Promise<ApiResult<DeleteTrashedLibraryBookResult>> {
		const book = await this.bookRepository.getByIdIncludingTrashed(input.bookId);
		if (!book) {
			return apiError('Book not found', 404);
		}

		if (!book.deleted_at) {
			return apiError('Book is not in trash', 400);
		}

		const hasSharedStorageReference = await this.bookRepository.hasOtherBookWithStorageKey(
			book.s3_storage_key,
			book.id
		);
		if (!hasSharedStorageReference) {
			try {
				await this.storage.delete(`library/${book.s3_storage_key}`);
			} catch {
				// Ignore missing main object during permanent deletion.
			}

			if (book.progress_storage_key) {
				try {
					await this.storage.delete(`library/${book.progress_storage_key}`);
				} catch {
					// Ignore missing progress object during permanent deletion.
				}
			}

			await this.managedBookCoverService.deleteForBookStorageKey(book.s3_storage_key);
		}

		await this.bookRepository.delete(input.bookId);

		return apiOk({
			success: true,
			bookId: input.bookId
		});
	}
}
