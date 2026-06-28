import type {
	HardcoverProgressQueueJob,
	HardcoverProgressQueuePort
} from '$lib/server/application/ports/HardcoverProgressQueuePort';
import { and, asc, desc, eq, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import { drizzleDb } from '$lib/server/infrastructure/db/client';
import { books, hardcoverProgressSyncJobs } from '$lib/server/infrastructure/db/schema';

export type HardcoverProgressJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
export type HardcoverProgressJob = typeof hardcoverProgressSyncJobs.$inferSelect;

export class HardcoverProgressSyncJobRepository implements HardcoverProgressQueuePort {
	async getAll(): Promise<HardcoverProgressJob[]> {
		return drizzleDb.select().from(hardcoverProgressSyncJobs);
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

	async recoverProcessing(staleBefore: string): Promise<void> {
		await drizzleDb
			.update(hardcoverProgressSyncJobs)
			.set({ status: 'pending', nextAttemptAt: null, updatedAt: new Date().toISOString() })
			.where(
				and(
					eq(hardcoverProgressSyncJobs.status, 'processing'),
					lte(hardcoverProgressSyncJobs.updatedAt, staleBefore)
				)
			);
	}

	async claimNextDue(): Promise<HardcoverProgressJob | null> {
		for (let attempt = 0; attempt < 3; attempt += 1) {
			const now = new Date().toISOString();
			const due = or(
				eq(hardcoverProgressSyncJobs.status, 'pending'),
				and(
					eq(hardcoverProgressSyncJobs.status, 'failed'),
					lte(hardcoverProgressSyncJobs.nextAttemptAt, now)
				)
			);
			const [candidate] = await drizzleDb
				.select({ id: hardcoverProgressSyncJobs.id })
				.from(hardcoverProgressSyncJobs)
				.where(due)
				.orderBy(asc(hardcoverProgressSyncJobs.updatedAt))
				.limit(1);
			if (!candidate) return null;

			const [claimed] = await drizzleDb
				.update(hardcoverProgressSyncJobs)
				.set({
					status: 'processing',
					attempts: sql`${hardcoverProgressSyncJobs.attempts} + 1`,
					updatedAt: now
				})
				.where(and(eq(hardcoverProgressSyncJobs.id, candidate.id), due))
				.returning();
			if (claimed) return claimed;
		}
		return null;
	}

	async markCompleted(
		job: HardcoverProgressJob,
		input: { hardcoverBookId: string; hardcoverUserBookId: number; outcome: string }
	): Promise<boolean> {
		const now = new Date().toISOString();
		const updated = await drizzleDb
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
			.where(this.matchesClaim(job))
			.returning({ id: hardcoverProgressSyncJobs.id });
		return updated.length > 0;
	}

	async markSkipped(job: HardcoverProgressJob, outcome: string): Promise<boolean> {
		const now = new Date().toISOString();
		const updated = await drizzleDb
			.update(hardcoverProgressSyncJobs)
			.set({ status: 'skipped', outcome, error: null, nextAttemptAt: null, updatedAt: now, completedAt: now })
			.where(this.matchesClaim(job))
			.returning({ id: hardcoverProgressSyncJobs.id });
		return updated.length > 0;
	}

	async markFailed(job: HardcoverProgressJob, error: string, isRetryable: boolean): Promise<boolean> {
		const now = new Date();
		const delayMs = Math.min(60 * 60 * 1000, 5_000 * 2 ** Math.max(0, job.attempts - 1));
		const updated = await drizzleDb
			.update(hardcoverProgressSyncJobs)
			.set({
				status: 'failed',
				error,
				nextAttemptAt: isRetryable && job.attempts < 6 ? new Date(now.getTime() + delayMs).toISOString() : null,
				updatedAt: now.toISOString()
			})
			.where(this.matchesClaim(job))
			.returning({ id: hardcoverProgressSyncJobs.id });
		return updated.length > 0;
	}

	async getNextWorkerWakeAt(processingLeaseMs: number): Promise<string | null> {
		const [retryRows, processingRows] = await Promise.all([
			drizzleDb
				.select({ at: hardcoverProgressSyncJobs.nextAttemptAt })
				.from(hardcoverProgressSyncJobs)
				.where(
					and(
						eq(hardcoverProgressSyncJobs.status, 'failed'),
						isNotNull(hardcoverProgressSyncJobs.nextAttemptAt)
					)
				)
				.orderBy(asc(hardcoverProgressSyncJobs.nextAttemptAt))
				.limit(1),
			drizzleDb
				.select({ at: hardcoverProgressSyncJobs.updatedAt })
				.from(hardcoverProgressSyncJobs)
				.where(eq(hardcoverProgressSyncJobs.status, 'processing'))
				.orderBy(asc(hardcoverProgressSyncJobs.updatedAt))
				.limit(1)
		]);
		const candidates = [
			retryRows[0]?.at ?? null,
			processingRows[0]?.at
				? new Date(new Date(processingRows[0].at).getTime() + processingLeaseMs).toISOString()
				: null
		].filter((value): value is string => value !== null);
		return candidates.sort()[0] ?? null;
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
			.orderBy(desc(hardcoverProgressSyncJobs.updatedAt))
			.limit(limit);
		return rows;
	}

	private matchesClaim(job: HardcoverProgressJob) {
		return and(
			eq(hardcoverProgressSyncJobs.id, job.id),
			eq(hardcoverProgressSyncJobs.status, 'processing'),
			eq(hardcoverProgressSyncJobs.attempts, job.attempts),
			eq(hardcoverProgressSyncJobs.updatedAt, job.updatedAt),
			eq(hardcoverProgressSyncJobs.sourceProgressPercent, job.sourceProgressPercent),
			job.sourceProgressUpdatedAt === null
				? isNull(hardcoverProgressSyncJobs.sourceProgressUpdatedAt)
				: eq(hardcoverProgressSyncJobs.sourceProgressUpdatedAt, job.sourceProgressUpdatedAt)
		);
	}
}
