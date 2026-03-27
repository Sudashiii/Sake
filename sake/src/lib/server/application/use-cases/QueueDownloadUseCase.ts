import { apiOk, type ApiResult } from '$lib/server/http/api';
import type { DownloadQueuePort } from '$lib/server/application/ports/DownloadQueuePort';
import type { ZDownloadBookRequest } from '$lib/types/ZLibrary/Requests/ZDownloadBookRequest';

interface QueueDownloadInput {
	request: ZDownloadBookRequest;
	credentials: { userId: string; userKey: string };
}

interface QueueDownloadResult {
	success: true;
	taskId: string;
	message: string;
	queueStatus: {
		pending: number;
		processing: number;
	};
}

export class QueueDownloadUseCase {
	constructor(private readonly queue: DownloadQueuePort) {}

	async execute(input: QueueDownloadInput): Promise<ApiResult<QueueDownloadResult>> {
		const { request, credentials } = input;
		const taskId = await this.queue.enqueue({
			source: 'zlibrary',
			bookId: request.bookId,
			hash: request.hash,
			title: request.title,
			extension: request.extension ?? 'epub',
			author: request.author ?? null,
			publisher: request.publisher ?? null,
			series: request.series ?? null,
			volume: request.volume ?? null,
			seriesIndex: request.seriesIndex ?? null,
			edition: request.edition ?? null,
			identifier: request.identifier ?? null,
			pages: request.pages ?? null,
			description: request.description ?? null,
			cover: request.cover ?? null,
			filesize: request.filesize ?? null,
			language: request.language ?? null,
			year: request.year ?? null,
			userId: credentials.userId,
			userKey: credentials.userKey
		});
		const queueStatus = await this.queue.getStatus();

		return apiOk({
			success: true,
			taskId,
			message: 'Download queued successfully',
			queueStatus
		});
	}
}
