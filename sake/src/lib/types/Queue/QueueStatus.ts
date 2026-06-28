export type QueueJobType = 'book-download' | 'hardcover-progress-sync';
export type QueueJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'skipped';

export interface QueueJob {
	id: string;
	type: QueueJobType;
	bookId: string;
	title: string;
	status: QueueJobStatus;
	attempts: number;
	maxRetries: number;
	author?: string;
	error?: string;
	outcomeMessage?: string;
	targetProgressPercent?: number;
	nextAttemptAt?: string;
	createdAt: string;
	updatedAt: string;
	finishedAt?: string;
}

export interface QueueStatusResponse {
	success: true;
	queueStatus: {
		pending: number;
		processing: number;
	};
	jobs: QueueJob[];
}
