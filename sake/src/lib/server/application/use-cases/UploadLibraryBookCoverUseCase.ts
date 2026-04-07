import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import {
	ManagedBookCoverService,
	MAX_MANAGED_BOOK_COVER_BYTES
} from '$lib/server/application/services/ManagedBookCoverService';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import { toUpdateMetadataInput } from './bookCoverMetadata';

interface UploadLibraryBookCoverInput {
	bookId: number;
	fileData: ArrayBuffer;
	contentType: string;
}

interface UploadLibraryBookCoverResult {
	success: true;
	bookId: number;
	cover: string;
}

export class UploadLibraryBookCoverUseCase {
	constructor(
		private readonly bookRepository: BookRepositoryPort,
		private readonly managedBookCoverService: Pick<ManagedBookCoverService, 'storeFromBuffer'>
	) {}

	async execute(
		input: UploadLibraryBookCoverInput
	): Promise<ApiResult<UploadLibraryBookCoverResult>> {
		const book = await this.bookRepository.getById(input.bookId);
		if (!book) {
			return apiError('Book not found', 404);
		}

		const contentType = input.contentType.trim().toLowerCase();
		if (!contentType.startsWith('image/')) {
			return apiError('Cover upload must be an image file', 400);
		}

		const coverBuffer = Buffer.from(input.fileData);
		if (coverBuffer.byteLength === 0) {
			return apiError('Cover upload was empty', 400);
		}
		if (coverBuffer.byteLength > MAX_MANAGED_BOOK_COVER_BYTES) {
			return apiError('Cover upload exceeds the maximum size limit', 400);
		}

		const uploadedCover = await this.managedBookCoverService.storeFromBuffer({
			bookStorageKey: book.s3_storage_key,
			coverBuffer,
			contentType
		});
		if (!uploadedCover.managedUrl) {
			return apiError('Failed to store cover image', 502);
		}

		await this.bookRepository.updateMetadata(
			input.bookId,
			toUpdateMetadataInput(book, uploadedCover.managedUrl)
		);

		return apiOk({
			success: true,
			bookId: input.bookId,
			cover: uploadedCover.managedUrl
		});
	}
}
