import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import {
	ManagedBookCoverService,
	isManagedBookCoverUrl
} from '$lib/server/application/services/ManagedBookCoverService';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import { toUpdateMetadataInput } from './bookCoverMetadata';

interface ImportLibraryBookCoverInput {
	bookId: number;
	coverUrl?: string | null;
}

interface ImportLibraryBookCoverResult {
	success: true;
	bookId: number;
	cover: string;
}

function trimToNull(value: string | null | undefined): string | null {
	if (typeof value !== 'string') {
		return null;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export class ImportLibraryBookCoverUseCase {
	constructor(
		private readonly bookRepository: BookRepositoryPort,
		private readonly managedBookCoverService: Pick<ManagedBookCoverService, 'storeFromExternalUrl'>
	) {}

	async execute(
		input: ImportLibraryBookCoverInput
	): Promise<ApiResult<ImportLibraryBookCoverResult>> {
		const book = await this.bookRepository.getById(input.bookId);
		if (!book) {
			return apiError('Book not found', 404);
		}

		const sourceCoverUrl = trimToNull(input.coverUrl) ?? trimToNull(book.cover);
		if (sourceCoverUrl === null) {
			return apiError('No cover URL available to import', 400);
		}

		if (isManagedBookCoverUrl(sourceCoverUrl)) {
			return apiError('Cover is already stored internally', 400);
		}

		const importedCover = await this.managedBookCoverService.storeFromExternalUrl({
			bookStorageKey: book.s3_storage_key,
			coverUrl: sourceCoverUrl
		});
		if (!importedCover.managedUrl) {
			return apiError('Failed to import cover image', 502);
		}

		await this.bookRepository.updateMetadata(
			input.bookId,
			toUpdateMetadataInput(book, importedCover.managedUrl)
		);

		return apiOk({
			success: true,
			bookId: input.bookId,
			cover: importedCover.managedUrl
		});
	}
}
