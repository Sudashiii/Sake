import { drizzleDb } from '$lib/server/infrastructure/db/client';
import { queueJobs } from '$lib/server/infrastructure/db/schema';
import { createChildLogger } from '$lib/server/infrastructure/logging/logger';
import {
	PERSISTED_QUEUE_USER_KEY,
	sanitizePersistedQueueJob,
	RECOVERY_REQUEUE_REQUIRED_ERROR,
	RECOVERY_ZLIBRARY_CREDENTIALS_MISSING_ERROR
} from '$lib/server/infrastructure/queue/persistence';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

export type QueueJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface QueueJobRecord {
	id: string;
	bookId: string;
	hash: string;
	title: string;
	extension: string;
	author: string | null;
	publisher: string | null;
	series: string | null;
	volume: string | null;
	seriesIndex: number | null;
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
	taskType: 'zlibrary' | 'provider-import' | null;
	taskPayload: string | null;
	status: QueueJobStatus;
	attempts: number;
	maxAttempts: number;
	error?: string;
	createdAt: string;
	updatedAt: string;
	finishedAt?: string;
}

function mapQueueJobRow(row: typeof queueJobs.$inferSelect): QueueJobRecord {
	return {
		id: row.id,
		bookId: row.bookId,
		hash: row.hash,
		title: row.title,
		extension: row.extension,
		author: row.author ?? null,
		publisher: row.publisher ?? null,
		series: row.series ?? null,
		volume: row.volume ?? null,
		seriesIndex: row.seriesIndex ?? null,
		edition: row.edition ?? null,
		identifier: row.identifier ?? null,
		pages: row.pages ?? null,
		description: row.description ?? null,
		cover: row.cover ?? null,
		filesize: row.filesize ?? null,
		language: row.language ?? null,
		year: row.year ?? null,
		userId: row.userId,
		userKey: row.userKey,
		taskType: row.taskType ?? null,
		taskPayload: row.taskPayload ?? null,
		status: row.status,
		attempts: row.attempts,
		maxAttempts: row.maxAttempts,
		error: row.error ?? undefined,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		finishedAt: row.finishedAt ?? undefined
	};
}

export class QueueJobRepository {
	private readonly repoLogger = createChildLogger({ repository: 'QueueJobRepository' });

	async create(job: QueueJobRecord): Promise<void> {
		const persistedJob = sanitizePersistedQueueJob(job);
		await drizzleDb.insert(queueJobs).values({
			id: persistedJob.id,
			bookId: persistedJob.bookId,
			hash: persistedJob.hash,
			title: persistedJob.title,
			extension: persistedJob.extension,
			author: persistedJob.author,
			publisher: persistedJob.publisher,
			series: persistedJob.series,
			volume: persistedJob.volume,
			seriesIndex: persistedJob.seriesIndex,
			edition: persistedJob.edition,
			identifier: persistedJob.identifier,
			pages: persistedJob.pages,
			description: persistedJob.description,
			cover: persistedJob.cover,
			filesize: persistedJob.filesize,
			language: persistedJob.language,
			year: persistedJob.year,
			userId: persistedJob.userId,
			userKey: persistedJob.userKey,
			taskType: persistedJob.taskType,
			taskPayload: persistedJob.taskPayload,
			status: persistedJob.status,
			attempts: persistedJob.attempts,
			maxAttempts: persistedJob.maxAttempts,
			error: persistedJob.error ?? null,
			createdAt: persistedJob.createdAt,
			updatedAt: persistedJob.updatedAt,
			finishedAt: persistedJob.finishedAt ?? null
		});

		this.repoLogger.info(
			{ event: 'queue_job.created', taskId: job.id, bookId: job.bookId, title: job.title },
			'Queue job created'
		);
	}

	async updateProcessing(id: string, attempts: number, updatedAt: string): Promise<void> {
		await drizzleDb
			.update(queueJobs)
			.set({
				status: 'processing',
				attempts,
				error: null,
				updatedAt,
				finishedAt: null
			})
		.where(eq(queueJobs.id, id));
	}

	async claimNextQueued(): Promise<QueueJobRecord | null> {
		const [candidate] = await drizzleDb
			.select()
			.from(queueJobs)
			.where(eq(queueJobs.status, 'queued'))
			.orderBy(queueJobs.createdAt)
			.limit(1);
		if (!candidate) {
			return null;
		}

		const now = new Date().toISOString();
		const [claimed] = await drizzleDb
			.update(queueJobs)
			.set({ status: 'processing', updatedAt: now, error: null, finishedAt: null })
			.where(and(eq(queueJobs.id, candidate.id), eq(queueJobs.status, 'queued')))
			.returning();
		return claimed ? mapQueueJobRow(claimed) : null;
	}

	async updateCompleted(id: string, attempts: number, updatedAt: string, finishedAt: string): Promise<void> {
		await drizzleDb
			.update(queueJobs)
			.set({
				status: 'completed',
				attempts,
				error: null,
				userKey: PERSISTED_QUEUE_USER_KEY,
				updatedAt,
				finishedAt
			})
			.where(eq(queueJobs.id, id));
	}

	async updateFailed(
		id: string,
		attempts: number,
		error: string,
		updatedAt: string,
		finishedAt: string
	): Promise<void> {
		await drizzleDb
			.update(queueJobs)
			.set({
				status: 'failed',
				attempts,
				error,
				userKey: PERSISTED_QUEUE_USER_KEY,
				updatedAt,
				finishedAt
			})
			.where(eq(queueJobs.id, id));
	}

	async recoverActiveJobsAfterRestart(updatedAt: string, finishedAt: string): Promise<number> {
		const resumableCondition = and(
			inArray(queueJobs.status, ['queued', 'processing']),
			sql`${queueJobs.taskPayload} is not null`,
			sql`${queueJobs.taskType} = 'provider-import'`
		);
		await drizzleDb
			.update(queueJobs)
			.set({ status: 'queued', updatedAt, error: null, finishedAt: null })
			.where(resumableCondition);

		const nonResumableCondition = and(
			inArray(queueJobs.status, ['queued', 'processing']),
			sql`(${queueJobs.taskPayload} is null or ${queueJobs.taskType} = 'zlibrary')`
		);
		const [countRow] = await drizzleDb
			.select({ count: sql<number>`count(*)` })
			.from(queueJobs)
			.where(nonResumableCondition);
		const count = Number(countRow?.count ?? 0);
		if (count > 0) {
			await drizzleDb
				.update(queueJobs)
				.set({
					status: 'failed',
					error: sql`case when ${queueJobs.taskType} = 'zlibrary' then ${RECOVERY_ZLIBRARY_CREDENTIALS_MISSING_ERROR} else ${RECOVERY_REQUEUE_REQUIRED_ERROR} end`,
					userKey: PERSISTED_QUEUE_USER_KEY,
					updatedAt,
					finishedAt
				})
				.where(nonResumableCondition);
			this.repoLogger.warn(
				{ event: 'queue_job.recovery.failed', count, updatedAt },
				'Marked queue jobs without resumable payloads as failed'
			);
		}
		return count;
	}

	async getStatusCounts(): Promise<{ pending: number; processing: number }> {
		const rows = await drizzleDb
			.select({
				status: queueJobs.status,
				count: sql<number>`count(*)`
			})
			.from(queueJobs)
			.where(inArray(queueJobs.status, ['queued', 'processing']))
			.groupBy(queueJobs.status);

		const counts = new Map(rows.map((row) => [row.status, Number(row.count)]));
		return {
			pending: counts.get('queued') ?? 0,
			processing: counts.get('processing') ?? 0
		};
	}

	async listRecent(limit = 200): Promise<QueueJobRecord[]> {
		const rows = await drizzleDb
			.select()
			.from(queueJobs)
			.orderBy(desc(queueJobs.createdAt))
			.limit(limit);
		return rows.map((row) => mapQueueJobRow(row));
	}

	async purgeTerminalOlderThan(cutoffIso: string): Promise<number> {
		const condition = and(
			inArray(queueJobs.status, ['completed', 'failed']),
			sql`coalesce(${queueJobs.finishedAt}, ${queueJobs.updatedAt}) < ${cutoffIso}`
		);
		const [countRow] = await drizzleDb
			.select({ count: sql<number>`count(*)` })
			.from(queueJobs)
			.where(condition);
		const count = Number(countRow?.count ?? 0);
		if (count === 0) {
			return 0;
		}

		await drizzleDb.delete(queueJobs).where(condition);
		this.repoLogger.info(
			{ event: 'queue_job.purged', count, cutoffIso },
			'Purged old terminal queue jobs'
		);
		return count;
	}
}
