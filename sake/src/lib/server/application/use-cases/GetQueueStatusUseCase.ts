import { apiOk, type ApiResult } from '$lib/server/http/api';
import type { DownloadQueuePort } from '$lib/server/application/ports/DownloadQueuePort';
import type {
	HardcoverProgressQueueJob,
	HardcoverProgressQueuePort
} from '$lib/server/application/ports/HardcoverProgressQueuePort';
import type {
	QueueJob,
	QueueJobStatus,
	QueueStatusResponse
} from '$lib/types/Queue/QueueStatus';

const MAX_RECENT_JOBS = 300;
const HARDCOVER_MAX_ATTEMPTS = 6;

const HARDCOVER_OUTCOME_MESSAGES: Record<string, string> = {
	book_not_found: 'Skipped because the book no longer exists in Sake.',
	isbn_unavailable: 'Skipped because the book has no ISBN or Hardcover ID.',
	no_exact_hardcover_match: 'Skipped because Hardcover has no exact ISBN match for this book.',
	ambiguous_hardcover_match: 'Skipped because the ISBN matches more than one Hardcover book.',
	hardcover_book_not_found: 'Skipped because the linked book no longer exists on Hardcover.',
	remote_progress_exists: 'Skipped initial sync because Hardcover already has reading progress or a completed read.',
	page_count_unavailable: 'Skipped because neither Sake nor Hardcover has a page count for this book.',
	marked_read: 'Marked the book as read on Hardcover.',
	progress_updated: 'Updated reading progress on Hardcover.'
};

function mapHardcoverStatus(job: HardcoverProgressQueueJob): QueueJobStatus {
	if (job.status === 'pending') return 'queued';
	if (job.status === 'failed' && job.nextAttemptAt) return 'queued';
	return job.status;
}

export class GetQueueStatusUseCase {
	constructor(
		private readonly downloadQueue: DownloadQueuePort,
		private readonly hardcoverQueue: HardcoverProgressQueuePort
	) {}

	async execute(): Promise<ApiResult<QueueStatusResponse>> {
		const [downloadStatus, downloadJobs, hardcoverStatus, hardcoverJobs] = await Promise.all([
			this.downloadQueue.getStatus(),
			this.downloadQueue.getTasks(),
			this.hardcoverQueue.activeCounts(),
			this.hardcoverQueue.listRecent(MAX_RECENT_JOBS)
		]);
		const jobs: QueueJob[] = [
			...downloadJobs.map((job): QueueJob => ({
				...job,
				id: `download:${job.id}`,
				type: 'book-download',
				maxRetries: job.maxRetries
			})),
			...hardcoverJobs.map((job): QueueJob => ({
				id: `hardcover-progress:${job.id}`,
				type: 'hardcover-progress-sync',
				bookId: String(job.bookId),
				title: job.title,
				status: mapHardcoverStatus(job),
				attempts: job.attempts,
				maxRetries: HARDCOVER_MAX_ATTEMPTS,
				author: job.author ?? undefined,
				error: job.error ?? undefined,
				outcomeMessage: job.outcome
					? (HARDCOVER_OUTCOME_MESSAGES[job.outcome] ?? job.outcome)
					: undefined,
				targetProgressPercent: Math.round(job.sourceProgressPercent * 100),
				nextAttemptAt: job.nextAttemptAt ?? undefined,
				createdAt: job.createdAt,
				updatedAt: job.updatedAt,
				finishedAt: job.completedAt ?? undefined
			}))
		]
			.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
			.slice(0, MAX_RECENT_JOBS);

		return apiOk({
			success: true,
			queueStatus: {
				pending: downloadStatus.pending + hardcoverStatus.pending,
				processing: downloadStatus.processing + hardcoverStatus.processing
			},
			jobs
		});
	}
}
