import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import { apiOk, type ApiResult } from '$lib/server/http/api';

interface ResetDownloadStatusResult {
	success: true;
}

export class ResetDownloadStatusUseCase {
	constructor(private readonly bookRepository: BookRepositoryPort) {}

	async execute(bookId: number): Promise<ApiResult<ResetDownloadStatusResult>> {
		await this.bookRepository.resetDownloadStatus(bookId);
		return apiOk({ success: true });
	}
}
