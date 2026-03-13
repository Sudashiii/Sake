import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { BookProgressHistoryRepositoryPort } from '$lib/server/application/ports/BookProgressHistoryRepositoryPort';
import type { DeviceProgressDownloadRepositoryPort } from '$lib/server/application/ports/DeviceProgressDownloadRepositoryPort';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import {
	buildProgressLookupTitleCandidates,
	buildProgressFileDescriptor
} from '$lib/server/domain/value-objects/ProgressFile';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import { createChildLogger } from '$lib/server/infrastructure/logging/logger';

interface PutProgressInput {
	fileName: string;
	fileData: ArrayBuffer;
	percentFinished: number;
	deviceId?: string;
}

interface PutProgressResult {
	progressKey: string;
}

function isMissingProgressHistoryTableError(cause: unknown): boolean {
	if (!(cause instanceof Error)) {
		return false;
	}

	const message = cause.message.toLowerCase();
	return message.includes('bookprogresshistory') && message.includes('no such table');
}

export class PutProgressUseCase {
	private readonly useCaseLogger = createChildLogger({ useCase: 'PutProgressUseCase' });

	constructor(
		private readonly bookRepository: BookRepositoryPort,
		private readonly bookProgressHistoryRepository: BookProgressHistoryRepositoryPort,
		private readonly storage: StoragePort,
		private readonly deviceProgressDownloadRepository: DeviceProgressDownloadRepositoryPort
	) {}

	async execute(input: PutProgressInput): Promise<ApiResult<PutProgressResult>> {
		const lookupCandidates = buildProgressLookupTitleCandidates(input.fileName);
		let book = undefined;
		let matchedStorageKey: string | null = null;
		for (const candidate of lookupCandidates) {
			book = await this.bookRepository.getByStorageKey(candidate);
			if (book) {
				matchedStorageKey = candidate;
				break;
			}
		}

		if (!book) {
			this.useCaseLogger.warn(
				{
					event: 'progress.book.not_found',
					fileName: input.fileName,
					searchedStorageKeys: lookupCandidates
				},
				`Book matching progress file "${input.fileName}" was not found`
			);
			return apiError('Book not found', 404);
		}

		this.useCaseLogger.info(
			{
				event: 'progress.book.matched',
				fileName: input.fileName,
				matchedStorageKey,
				bookId: book.id
			},
			'Matched progress file to book'
		);

		let progressKey: string;
		try {
			progressKey = buildProgressFileDescriptor(book.s3_storage_key).progressKey;
		} catch (cause) {
			this.useCaseLogger.error(
				{
					event: 'progress.key.build_failed',
					bookId: book.id,
					storageKey: book.s3_storage_key,
					fileName: input.fileName
				},
				'Failed to build progress file descriptor'
			);
			return apiError('Invalid title format. Expected filename with extension.', 400, cause);
		}

		const uploadKey = `library/${progressKey}`;
		await this.storage.put(uploadKey, Buffer.from(input.fileData), 'application/x-lua');
		const normalizedPercent = Math.max(0, Math.min(1, input.percentFinished));
		const previousPercent = typeof book.progress_percent === 'number' ? book.progress_percent : null;
		await this.bookRepository.updateProgress(book.id, progressKey, normalizedPercent);
		if (previousPercent === null || normalizedPercent > previousPercent) {
			try {
				await this.bookProgressHistoryRepository.appendSnapshot({
					bookId: book.id,
					progressPercent: normalizedPercent
				});
			} catch (cause: unknown) {
				if (isMissingProgressHistoryTableError(cause)) {
					this.useCaseLogger.warn(
						{
							event: 'progress.history.migration_missing',
							bookId: book.id
						},
						'Progress history table not available yet; skipping history snapshot'
					);
				} else {
					throw cause;
				}
			}
		} else {
			this.useCaseLogger.info(
				{
					event: 'progress.history.skipped.no_increase',
					bookId: book.id,
					previousPercent,
					newPercent: normalizedPercent
				},
				'Skipped progress history snapshot because progress did not increase'
			);
		}
		this.useCaseLogger.info(
			{
				event: 'progress.uploaded',
				bookId: book.id,
				progressKey,
				deviceId: input.deviceId ?? null,
				percentFinished: normalizedPercent
			},
			'Progress uploaded and book updated'
		);

		if (input.deviceId && input.deviceId.trim() !== '') {
			const updatedBook = await this.bookRepository.getById(book.id);
			if (updatedBook?.progress_updated_at) {
				await this.deviceProgressDownloadRepository.upsertByDeviceAndBook({
					deviceId: input.deviceId.trim(),
					bookId: book.id,
					progressUpdatedAt: updatedBook.progress_updated_at
				});
				this.useCaseLogger.info(
					{
						event: 'progress.device.confirmed',
						bookId: book.id,
						deviceId: input.deviceId.trim(),
						progressUpdatedAt: updatedBook.progress_updated_at
					},
					'Device progress download marker updated'
				);
			}
		}

		return apiOk({ progressKey });
	}
}
