import type {
	HardcoverProgressQueueJob,
	HardcoverProgressQueuePort
} from '$lib/server/application/ports/HardcoverProgressQueuePort';
import { and, asc, desc, eq, lte, or, sql } from 'drizzle-orm';
import { drizzleDb } from '$lib/server/infrastructure/db/client';
import { books, hardcoverProgressSyncJobs } from '$lib/server/infrastructure/db/schema';

export type HardcoverProgressJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
export type HardcoverProgressJob = typeof hardcoverProgressSyncJobs.$inferSelect;

export class HardcoverProgressSyncJobRepository implements HardcoverProgressQueuePort {
	async getByBookId(bookId: number): Promise<HardcoverProgressJob | null> {
		const [row] = await drizzleDb
			.select()
			.from(hardcoverProgressSyncJobs)
			.where(eq(hardcoverProgressSyncJobs.bookId, bookId))
			.limit(1);
		return row ?? null;
	}

	async enqueue(input: {
		bookId: number;
		progressPercent: number;
		progressUpdatedAt: string | null;
		isInitialSync: boolean;
	}): Promise<void> {
		const now = new Date().toISOString();
		await drizzleDb
			.insert(hardcoverProgressSyncJobs)
			.values({
				bookId: input.bookId,
				status: 'pending',
				sourceProgressPercent: input.progressPercent,
				sourceProgressUpdatedAt: input.progressUpdatedAt,
				isInitialSync: input.isInitialSync,
				createdAt: now,
				updatedAt: now
			})
			.onConflictDoUpdate({
				target: hardcoverProgressSyncJobs.bookId,
				set: {
					status: 'pending',
					sourceProgressPercent: input.progressPercent,
					sourceProgressUpdatedAt: input.progressUpdatedAt,
					isInitialSync: input.isInitialSync,
					attempts: 0,
					nextAttemptAt: null,
					error: null,
					outcome: null,
					updatedAt: now,
					completedAt: null
				}
			});
	}

	async recoverProcessing(): Promise<void> {
		await drizzleDb
			.update(hardcoverProgressSyncJobs)
			.set({ status: 'pending', nextAttemptAt: null, updatedAt: new Date().toISOString() })
			.where(eq(hardcoverProgressSyncJobs.status, 'processing'));
	}

	async nextDue(): Promise<HardcoverProgressJob | null> {
		const now = new Date().toISOString();
		const [row] = await drizzleDb
			.select()
			.from(hardcoverProgressSyncJobs)
			.where(
				or(
					eq(hardcoverProgressSyncJobs.status, 'pending'),
					and(
						eq(hardcoverProgressSyncJobs.status, 'failed'),
						lte(hardcoverProgressSyncJobs.nextAttemptAt, now)
					)
				)
			)
			.orderBy(asc(hardcoverProgressSyncJobs.updatedAt))
			.limit(1);
		return row ?? null;
	}

	async markProcessing(id: number): Promise<void> {
		await drizzleDb
			.update(hardcoverProgressSyncJobs)
			.set({
				status: 'processing',
				attempts: sql`${hardcoverProgressSyncJobs.attempts} + 1`,
				updatedAt: new Date().toISOString()
			})
			.where(eq(hardcoverProgressSyncJobs.id, id));
	}

	async markCompleted(
		id: number,
		input: { hardcoverBookId: string; hardcoverUserBookId: number; outcome: string }
	): Promise<void> {
		const now = new Date().toISOString();
		await drizzleDb
			.update(hardcoverProgressSyncJobs)
			.set({
				status: 'completed',
				hardcoverBookId: input.hardcoverBookId,
				hardcoverUserBookId: input.hardcoverUserBookId,
				outcome: input.outcome,
				error: null,
				nextAttemptAt: null,
				updatedAt: now,
				completedAt: now
			})
			.where(eq(hardcoverProgressSyncJobs.id, id));
	}

	async markSkipped(id: number, outcome: string): Promise<void> {
		const now = new Date().toISOString();
		await drizzleDb
			.update(hardcoverProgressSyncJobs)
			.set({ status: 'skipped', outcome, error: null, nextAttemptAt: null, updatedAt: now, completedAt: now })
			.where(eq(hardcoverProgressSyncJobs.id, id));
	}

	async markFailed(id: number, error: string, attempts: number, isRetryable: boolean): Promise<void> {
		const now = new Date();
		const delayMs = Math.min(60 * 60 * 1000, 5_000 * 2 ** Math.max(0, attempts - 1));
		await drizzleDb
			.update(hardcoverProgressSyncJobs)
			.set({
				status: 'failed',
				error,
				nextAttemptAt: isRetryable && attempts < 6 ? new Date(now.getTime() + delayMs).toISOString() : null,
				updatedAt: now.toISOString()
			})
			.where(eq(hardcoverProgressSyncJobs.id, id));
	}

	async counts(): Promise<Record<HardcoverProgressJobStatus, number>> {
		const rows = await drizzleDb
			.select({ status: hardcoverProgressSyncJobs.status, count: sql<number>`count(*)` })
			.from(hardcoverProgressSyncJobs)
			.groupBy(hardcoverProgressSyncJobs.status);
		const result = { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 };
		for (const row of rows) result[row.status] = Number(row.count);
		return result;
	}

	async activeCounts(): Promise<{ pending: number; processing: number }> {
		const rows = await drizzleDb
			.select({ status: hardcoverProgressSyncJobs.status, count: sql<number>`count(*)` })
			.from(hardcoverProgressSyncJobs)
			.where(
				or(
					eq(hardcoverProgressSyncJobs.status, 'pending'),
					eq(hardcoverProgressSyncJobs.status, 'processing'),
					and(
						eq(hardcoverProgressSyncJobs.status, 'failed'),
						sql`${hardcoverProgressSyncJobs.nextAttemptAt} is not null`
					)
				)
			)
			.groupBy(hardcoverProgressSyncJobs.status);
		const counts = new Map(rows.map((row) => [row.status, Number(row.count)]));
		return {
			pending: (counts.get('pending') ?? 0) + (counts.get('failed') ?? 0),
			processing: counts.get('processing') ?? 0
		};
	}

	async listRecent(limit: number): Promise<HardcoverProgressQueueJob[]> {
		const rows = await drizzleDb
			.select({
				id: hardcoverProgressSyncJobs.id,
				bookId: hardcoverProgressSyncJobs.bookId,
				title: books.title,
				author: books.author,
				status: hardcoverProgressSyncJobs.status,
				sourceProgressPercent: hardcoverProgressSyncJobs.sourceProgressPercent,
				attempts: hardcoverProgressSyncJobs.attempts,
				nextAttemptAt: hardcoverProgressSyncJobs.nextAttemptAt,
				error: hardcoverProgressSyncJobs.error,
				outcome: hardcoverProgressSyncJobs.outcome,
				createdAt: hardcoverProgressSyncJobs.createdAt,
				updatedAt: hardcoverProgressSyncJobs.updatedAt,
				completedAt: hardcoverProgressSyncJobs.completedAt
			})
			.from(hardcoverProgressSyncJobs)
			.innerJoin(books, eq(hardcoverProgressSyncJobs.bookId, books.id))
			.orderBy(desc(hardcoverProgressSyncJobs.createdAt))
			.limit(limit);
		return rows;
	}
}
