export type HardcoverProgressQueueJobStatus =
	| 'pending'
	| 'processing'
	| 'completed'
	| 'failed'
	| 'skipped';

export interface HardcoverProgressQueueJob {
	id: number;
	bookId: number;
	title: string;
	author: string | null;
	status: HardcoverProgressQueueJobStatus;
	sourceProgressPercent: number;
	attempts: number;
	nextAttemptAt: string | null;
	error: string | null;
	outcome: string | null;
	createdAt: string;
	updatedAt: string;
	completedAt: string | null;
}

export interface HardcoverProgressQueuePort {
	counts(): Promise<Record<HardcoverProgressQueueJobStatus, number>>;
	activeCounts(): Promise<{ pending: number; processing: number }>;
	listRecent(limit: number): Promise<HardcoverProgressQueueJob[]>;
}
