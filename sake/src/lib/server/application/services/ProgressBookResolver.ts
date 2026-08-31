import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { Book } from '$lib/server/domain/entities/Book';
import {
	buildProgressFileDescriptor,
	buildProgressLookupTitleCandidates
} from '$lib/server/domain/value-objects/ProgressFile';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import { createChildLogger } from '$lib/server/infrastructure/logging/logger';

export interface ResolvedProgressBook {
	book: Book;
	progressKey: string;
	matchedStorageKey: string;
}

export class ProgressBookResolver {
	private readonly serviceLogger = createChildLogger({ service: 'ProgressBookResolver' });

	constructor(private readonly bookRepository: BookRepositoryPort) {}

	async resolve(fileName: string): Promise<ApiResult<ResolvedProgressBook>> {
		const lookupCandidates = buildProgressLookupTitleCandidates(fileName);
		let book: Book | undefined;
		let matchedStorageKey: string | undefined;
		for (const candidate of lookupCandidates) {
			book = await this.bookRepository.getByStorageKey(candidate);
			if (book) {
				matchedStorageKey = candidate;
				break;
			}
		}

		if (!book || !matchedStorageKey) {
			this.serviceLogger.warn(
				{
					event: 'progress.book.not_found',
					fileName,
					searchedStorageKeys: lookupCandidates
				},
				`Book matching progress file "${fileName}" was not found`
			);
			return apiError('Book not found', 404);
		}

		this.serviceLogger.info(
			{
				event: 'progress.book.matched',
				fileName,
				matchedStorageKey,
				bookId: book.id
			},
			'Matched progress file to book'
		);

		try {
			const progressKey = buildProgressFileDescriptor(book.s3_storage_key).progressKey;
			return apiOk({ book, progressKey, matchedStorageKey });
		} catch (cause: unknown) {
			this.serviceLogger.error(
				{
					event: 'progress.key.build_failed',
					bookId: book.id,
					storageKey: book.s3_storage_key,
					fileName
				},
				'Failed to build progress file descriptor'
			);
			return apiError('Invalid title format. Expected filename with extension.', 400, cause);
		}
	}
}
