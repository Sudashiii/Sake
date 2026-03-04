import { apiOk, type ApiResult } from '$lib/server/http/api';
import type {
	DownloadQueuePort,
	QueueJobSnapshot
} from '$lib/server/application/ports/DownloadQueuePort';

interface GetQueueStatusResult {
	success: true;
	queueStatus: {
		pending: number;
		processing: number;
	};
	jobs: QueueJobSnapshot[];
}

export class GetQueueStatusUseCase {
	constructor(private readonly queue: DownloadQueuePort) {}

	async execute(): Promise<ApiResult<GetQueueStatusResult>> {
		const queueStatus = await this.queue.getStatus();
		const jobs = await this.queue.getTasks();
		return apiOk({
			success: true,
			queueStatus,
			jobs
		});
	}
}
