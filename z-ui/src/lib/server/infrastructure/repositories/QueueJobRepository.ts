import { drizzleDb } from '$lib/server/infrastructure/db/client';
import { queueJobs } from '$lib/server/infrastructure/db/schema';
import { createChildLogger } from '$lib/server/infrastructure/logging/logger';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

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
		await drizzleDb.insert(queueJobs).values({
			id: job.id,
			bookId: job.bookId,
			hash: job.hash,
			title: job.title,
			extension: job.extension,
			author: job.author,
			publisher: job.publisher,
			series: job.series,
			volume: job.volume,
			edition: job.edition,
			identifier: job.identifier,
			pages: job.pages,
			description: job.description,
			cover: job.cover,
			filesize: job.filesize,
			language: job.language,
			year: job.year,
			userId: job.userId,
			userKey: job.userKey,
			status: job.status,
			attempts: job.attempts,
			maxAttempts: job.maxAttempts,
			error: job.error ?? null,
			createdAt: job.createdAt,
			updatedAt: job.updatedAt,
			finishedAt: job.finishedAt ?? null
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

	async updateCompleted(id: string, attempts: number, updatedAt: string, finishedAt: string): Promise<void> {
		await drizzleDb
			.update(queueJobs)
			.set({
				status: 'completed',
				attempts,
				error: null,
				userKey: '',
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
				userKey: '',
				updatedAt,
				finishedAt
			})
			.where(eq(queueJobs.id, id));
	}

	async requeueProcessingJobs(updatedAt: string): Promise<void> {
		await drizzleDb
			.update(queueJobs)
			.set({
				status: 'queued',
				updatedAt
			})
			.where(eq(queueJobs.status, 'processing'));
	}

	async listQueuedForRecovery(): Promise<QueueJobRecord[]> {
		const rows = await drizzleDb
			.select()
			.from(queueJobs)
			.where(eq(queueJobs.status, 'queued'))
			.orderBy(asc(queueJobs.createdAt));
		return rows.map((row) => mapQueueJobRow(row));
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
