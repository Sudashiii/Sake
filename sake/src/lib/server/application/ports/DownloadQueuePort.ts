export interface DownloadQueueTaskInput {
	bookId: string;
	hash: string;
	title: string;
	extension: string;
	author: string | null;
	publisher: string | null;
	series: string | null;
	volume: string | null;
	edition: string | null;
	identifier: string | null;
	pages: number | null;
	description: string | null;
	cover: string | null;
	filesize: number | null;
	language: string | null;
	year: number | null;
	userId: string;
	userKey: string;
}

export interface QueueJobSnapshot {
	id: string;
	bookId: string;
	title: string;
	status: 'queued' | 'processing' | 'completed' | 'failed';
	attempts: number;
	maxRetries: number;
	author?: string;
	error?: string;
	createdAt: string;
	updatedAt: string;
	finishedAt?: string;
}

export interface DownloadQueuePort {
	enqueue(task: DownloadQueueTaskInput): Promise<string>;
	getStatus(): Promise<{ pending: number; processing: number }>;
	getTasks(): Promise<QueueJobSnapshot[]>;
}
