import { apiOk, type ApiResult } from '$lib/server/http/api';
import type { DownloadQueuePort } from '$lib/server/application/ports/DownloadQueuePort';
import type { QueueSearchBookRequest } from '$lib/types/Search/QueueSearchBookRequest';

interface QueueSearchBookInput {
	request: QueueSearchBookRequest;
	userId: string;
}

interface QueueSearchBookResult {
	success: true;
	taskId: string;
	message: string;
	queueStatus: {
		pending: number;
		processing: number;
	};
}

export class QueueSearchBookUseCase {
	constructor(private readonly queue: DownloadQueuePort) {}

	async execute(input: QueueSearchBookInput): Promise<ApiResult<QueueSearchBookResult>> {
		const { request, userId } = input;
		const taskId = await this.queue.enqueue({
			source: 'provider-import',
			provider: request.provider,
			bookId: `${request.provider}:${request.providerBookId}`,
			downloadRef: request.downloadRef,
			title: request.title,
			extension: request.extension ?? 'epub',
			author: request.author ?? null,
			publisher: null,
			series: request.series ?? null,
			volume: request.volume ?? null,
			seriesIndex: request.seriesIndex ?? null,
			edition: null,
			identifier: request.identifier ?? null,
			pages: request.pages ?? null,
			description: request.description ?? null,
			cover: request.cover ?? null,
			filesize: request.filesize ?? null,
			language: request.language ?? null,
			year: request.year ?? null,
			userId,
			userKey: ''
		});
		const queueStatus = await this.queue.getStatus();

		return apiOk({
			success: true,
			taskId,
			message: 'Provider import queued successfully',
			queueStatus
		});
	}
}
