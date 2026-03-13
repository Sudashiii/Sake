import { DownloadBookUseCase } from '$lib/server/application/use-cases/DownloadBookUseCase';
import { ZLibraryClient } from '$lib/server/infrastructure/clients/ZLibraryClient';
import { createChildLogger, toLogError } from '$lib/server/infrastructure/logging/logger';
import { QueueJobRepository } from '$lib/server/infrastructure/repositories/QueueJobRepository';
import type { QueueJobRecord } from '$lib/server/infrastructure/repositories/QueueJobRepository';
import { BookRepository } from '$lib/server/infrastructure/repositories/BookRepository';
import { DavUploadServiceFactory } from '$lib/server/infrastructure/factories/DavUploadServiceFactory';
import {
	RECOVERY_REQUEUE_REQUIRED_ERROR,
	PERSISTED_QUEUE_USER_KEY
} from '$lib/server/infrastructure/queue/persistence';
import { randomUUID } from 'node:crypto';

export interface QueuedDownload {
	id: string;
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
	status: 'queued' | 'processing' | 'completed' | 'failed';
	attempts: number;
	maxAttempts: number;
	error?: string;
	createdAt: Date;
	updatedAt: Date;
	finishedAt?: Date;
}

export interface QueuedDownloadSnapshot {
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

class DownloadQueue {
	private queue: QueuedDownload[] = [];
	private isProcessing = false;
	private readonly defaultMaxAttempts = 3;
	private readonly terminalRetentionMs = 90 * 24 * 60 * 60 * 1000;
	private readonly queueLogger = createChildLogger({ component: 'downloadQueue' });
	private readonly queueJobRepository = new QueueJobRepository();
	private isInitialized = false;
	private initializePromise: Promise<void> | null = null;

	private readonly downloadBookUseCase = new DownloadBookUseCase(
		new ZLibraryClient('https://1lib.sk'),
		new BookRepository(),
		() => DavUploadServiceFactory.createS3()
	);

	async enqueue(
		task: Omit<
			QueuedDownload,
			'id' | 'status' | 'attempts' | 'maxAttempts' | 'createdAt' | 'updatedAt' | 'finishedAt'
		>
	): Promise<string> {
		await this.ensureInitialized();

		const id = randomUUID();
		const now = new Date();

		const queuedTask: QueuedDownload = {
			...task,
			id,
			status: 'queued',
			attempts: 0,
			maxAttempts: this.defaultMaxAttempts,
			createdAt: now,
			updatedAt: now
		};

		this.queue.push(queuedTask);
		await this.queueJobRepository.create(this.toQueueJobRecord(queuedTask));
		this.queueLogger.info(
			{ event: 'queue.task.enqueued', taskId: id, bookId: task.bookId, title: task.title },
			'Queue task added'
		);

		void this.processQueue();
		return id;
	}

	async getStatus(): Promise<{ pending: number; processing: number }> {
		await this.ensureInitialized();
		return this.queueJobRepository.getStatusCounts();
	}

	async getTasks(): Promise<QueuedDownloadSnapshot[]> {
		await this.ensureInitialized();
		const tasks = await this.queueJobRepository.listRecent(300);
		return tasks.map((task) => ({
			id: task.id,
			bookId: task.bookId,
			title: task.title,
			status: task.status,
			attempts: task.attempts,
			maxRetries: task.maxAttempts,
			author: task.author ?? undefined,
			error: task.error,
			createdAt: task.createdAt,
			updatedAt: task.updatedAt,
			finishedAt: task.finishedAt
		}));
	}

	private async ensureInitialized(): Promise<void> {
		if (this.isInitialized) {
			return;
		}

		if (!this.initializePromise) {
			this.initializePromise = this.initialize();
		}

		await this.initializePromise;
	}

	private async initialize(): Promise<void> {
		try {
			const nowIso = new Date().toISOString();
			const failedRecoveredJobs = await this.queueJobRepository.failActiveJobsWithoutCredentials(
				RECOVERY_REQUEUE_REQUIRED_ERROR,
				nowIso,
				nowIso
			);
			await this.cleanupOldTerminalJobs();
			this.isInitialized = true;

			if (failedRecoveredJobs > 0) {
				this.queueLogger.warn(
					{
						event: 'queue.recovery.credentials_missing',
						failedRecoveredJobs
					},
					'Marked queued jobs as failed because queue credentials are not persisted across restart'
				);
			}
		} catch (error: unknown) {
			this.initializePromise = null;
			throw error;
		}
	}

	private async processQueue(): Promise<void> {
		if (this.isProcessing) {
			return;
		}

		this.isProcessing = true;
		try {
			while (true) {
					const task = this.queue.find((candidate) => candidate.status === 'queued');
					if (!task) {
						break;
					}

					task.status = 'processing';
					task.updatedAt = new Date();
					this.queueLogger.info(
						{ event: 'queue.task.processing', taskId: task.id, bookId: task.bookId, title: task.title },
						'Processing queue task'
					);

				try {
					await this.processTask(task);
					task.status = 'completed';
					task.updatedAt = new Date();
					task.finishedAt = task.updatedAt;
					await this.queueJobRepository.updateCompleted(
						task.id,
						task.attempts,
						task.updatedAt.toISOString(),
						task.finishedAt.toISOString()
					);
					this.queueLogger.info(
						{
							event: 'queue.task.completed',
							taskId: task.id,
							bookId: task.bookId,
							title: task.title
						},
						'Queue task completed'
					);
				} catch (error) {
					task.status = 'failed';
					task.error = error instanceof Error ? error.message : 'Unknown error';
					task.updatedAt = new Date();
					task.finishedAt = task.updatedAt;
					await this.queueJobRepository.updateFailed(
						task.id,
						task.attempts,
						task.error,
						task.updatedAt.toISOString(),
						task.finishedAt.toISOString()
					);
					this.queueLogger.error(
						{
							event: 'queue.task.failed',
							taskId: task.id,
							bookId: task.bookId,
							title: task.title,
							error: toLogError(error)
						},
						'Queue task failed'
					);
					} finally {
						this.queue = this.queue.filter((candidate) => candidate.id !== task.id);
					}
				}
				await this.cleanupOldTerminalJobs();
			} finally {
				this.isProcessing = false;
			}
		}

	private async processTask(task: QueuedDownload): Promise<void> {
		const firstAttempt = Math.max(1, task.attempts + 1);
		if (firstAttempt > task.maxAttempts) {
			throw new Error('Maximum retry attempts exceeded');
		}

		for (let attempt = firstAttempt; attempt <= task.maxAttempts; attempt++) {
			task.attempts = attempt;
			task.updatedAt = new Date();
			await this.queueJobRepository.updateProcessing(
				task.id,
				task.attempts,
				task.updatedAt.toISOString()
			);

			const useCaseResult = await this.downloadBookUseCase.execute({
				request: {
					bookId: task.bookId,
					hash: task.hash,
					title: task.title,
					upload: true,
					extension: task.extension,
					author: task.author ?? undefined,
					publisher: task.publisher ?? undefined,
					series: task.series ?? undefined,
					volume: task.volume ?? undefined,
					edition: task.edition ?? undefined,
					identifier: task.identifier ?? undefined,
					pages: task.pages ?? undefined,
					description: task.description ?? undefined,
					cover: task.cover ?? undefined,
					filesize: task.filesize ?? undefined,
					language: task.language ?? undefined,
					year: task.year ?? undefined,
					downloadToDevice: false
				},
				credentials: {
					userId: task.userId,
					userKey: task.userKey
				}
			});

			if (useCaseResult.ok) {
				return;
			}

			const canRetry = this.isRetryableFailure(
				useCaseResult.error.status,
				useCaseResult.error.message
			);
			const isLastAttempt = attempt === task.maxAttempts;
			if (!canRetry || isLastAttempt) {
				throw new Error(useCaseResult.error.message, { cause: useCaseResult.error.cause });
			}

			const delayMs = this.getRetryDelayMs(attempt);
			this.queueLogger.warn(
				{
					event: 'queue.task.retry',
					taskId: task.id,
					bookId: task.bookId,
					attempt,
					nextAttempt: attempt + 1,
					delayMs,
					statusCode: useCaseResult.error.status,
					reason: useCaseResult.error.message
				},
				'Queue task failed with retryable error, retrying'
			);
			await this.sleep(delayMs);
		}

		throw new Error('Queue task failed without terminal result');
	}

	private isRetryableFailure(statusCode: number, message: string): boolean {
		if (statusCode === 429 || statusCode >= 500) {
			return true;
		}

		const normalized = message.toLowerCase();
		return (
			normalized.includes('terminated') ||
			normalized.includes('timeout') ||
			normalized.includes('econnreset') ||
			normalized.includes('network') ||
			normalized.includes('failed to execute get request') ||
			normalized.includes('failed to execute post request')
		);
	}

	private getRetryDelayMs(attempt: number): number {
		// 500ms, 1000ms, 2000ms...
		return 500 * 2 ** (attempt - 1);
	}

	private async sleep(ms: number): Promise<void> {
		await new Promise<void>((resolve) => {
			setTimeout(() => resolve(), ms);
		});
	}

	private async cleanupOldTerminalJobs(): Promise<void> {
		const cutoffIso = new Date(Date.now() - this.terminalRetentionMs).toISOString();
		const deleted = await this.queueJobRepository.purgeTerminalOlderThan(cutoffIso);
		if (deleted > 0) {
			this.queueLogger.info(
				{ event: 'queue.cleanup.purged', deleted, cutoffIso },
				'Purged old terminal queue jobs'
			);
		}
	}

	private toQueueJobRecord(task: QueuedDownload): QueueJobRecord {
		return {
			id: task.id,
			bookId: task.bookId,
			hash: task.hash,
			title: task.title,
			extension: task.extension,
			author: task.author,
			publisher: task.publisher,
			series: task.series,
			volume: task.volume,
			edition: task.edition,
			identifier: task.identifier,
			pages: task.pages,
			description: task.description,
			cover: task.cover,
			filesize: task.filesize,
			language: task.language,
			year: task.year,
			userId: task.userId,
			userKey: PERSISTED_QUEUE_USER_KEY,
			status: task.status,
			attempts: task.attempts,
			maxAttempts: task.maxAttempts,
			error: task.error,
			createdAt: task.createdAt.toISOString(),
			updatedAt: task.updatedAt.toISOString(),
			finishedAt: task.finishedAt?.toISOString()
		};
	}
}

// Singleton instance
export const downloadQueue = new DownloadQueue();
