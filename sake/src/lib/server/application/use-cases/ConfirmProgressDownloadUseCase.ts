import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { DeviceProgressDownloadRepositoryPort } from '$lib/server/application/ports/DeviceProgressDownloadRepositoryPort';
import type { DeviceProgressDownload } from '$lib/server/domain/entities/DeviceProgressDownload';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface ConfirmProgressDownloadInput {
	deviceId: string;
	bookId: number;
}

export class ConfirmProgressDownloadUseCase {
	constructor(
		private readonly bookRepository: BookRepositoryPort,
		private readonly deviceProgressDownloadRepository: DeviceProgressDownloadRepositoryPort
	) {}

	async execute(
		input: ConfirmProgressDownloadInput
	): Promise<ApiResult<DeviceProgressDownload>> {
		const book = await this.bookRepository.getById(input.bookId);
		if (!book) {
			return apiError('Book not found', 404);
		}
		if (!book.progress_updated_at) {
			return apiError('Book has no progress update to confirm', 409);
		}

		const record = await this.deviceProgressDownloadRepository.upsertByDeviceAndBook({
			deviceId: input.deviceId,
			bookId: input.bookId,
			progressUpdatedAt: book.progress_updated_at
		});

		return apiOk(record);
	}
}
