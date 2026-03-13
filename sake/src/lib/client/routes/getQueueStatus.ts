import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import { get } from '../base/get';

export interface QueueJob {
	id: string;
	bookId: string;
	title: string;
	status: 'queued' | 'processing' | 'completed' | 'failed';
	attempts: number;
	error?: string;
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

export async function getQueueStatus(): Promise<Result<QueueStatusResponse, ApiError>> {
	const result = await get('/zlibrary/queue');
	if (!result.ok) {
		return err(result.error);
	}

	try {
		return ok((await result.value.json()) as QueueStatusResponse);
	} catch {
		return err(ApiErrors.server('Failed to parse queue status response', 500));
	}
}
