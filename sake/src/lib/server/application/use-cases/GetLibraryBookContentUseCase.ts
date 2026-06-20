import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

export interface LibraryBookContent {
	data: ArrayBuffer;
	contentLength: string;
	fileName: string;
}

export class GetLibraryBookContentUseCase {
	constructor(
		private readonly bookRepository: BookRepositoryPort,
		private readonly storage: StoragePort
	) {}

	async execute(bookId: number): Promise<ApiResult<LibraryBookContent>> {
		const book = await this.bookRepository.getById(bookId);
		if (!book) {
			return apiError('Book not found', 404);
		}
		if (book.extension?.toLowerCase() !== 'epub') {
			return apiError('Web reader supports EPUB books only', 415);
		}

		try {
			const data = await this.storage.get(`library/${book.s3_storage_key}`);
			return apiOk({
				data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
				contentLength: data.length.toString(),
				fileName: book.s3_storage_key
			});
		} catch (cause) {
			return apiError('Book file not found', 404, cause);
		}
	}
}
