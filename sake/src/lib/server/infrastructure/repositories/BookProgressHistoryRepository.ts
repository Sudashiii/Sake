import type { BookProgressHistoryRepositoryPort } from '$lib/server/application/ports/BookProgressHistoryRepositoryPort';
import type { BookProgressHistory } from '$lib/server/domain/entities/BookProgressHistory';
import { drizzleDb } from '$lib/server/infrastructure/db/client';
import { bookProgressHistory } from '$lib/server/infrastructure/db/schema';
import { createChildLogger } from '$lib/server/infrastructure/logging/logger';
import { and, desc, eq } from 'drizzle-orm';

export class BookProgressHistoryRepository implements BookProgressHistoryRepositoryPort {
	private readonly repoLogger = createChildLogger({ repository: 'BookProgressHistoryRepository' });

	async appendSnapshot(
		input: Omit<BookProgressHistory, 'id' | 'recordedAt'>
	): Promise<BookProgressHistory> {
		const [created] = await drizzleDb
			.insert(bookProgressHistory)
			.values({
				bookId: input.bookId,
				progressPercent: input.progressPercent,
				recordedAt: new Date().toISOString()
			})
			.onConflictDoNothing({
				target: [bookProgressHistory.bookId, bookProgressHistory.recordedAt]
			})
			.returning();

		if (created) {
			this.repoLogger.info(
				{
					event: 'book.progress_history.appended',
					bookId: created.bookId,
					progressPercent: created.progressPercent,
					recordedAt: created.recordedAt
				},
				'Book progress history snapshot appended'
			);
			return created;
		}

		const [existing] = await drizzleDb
			.select()
			.from(bookProgressHistory)
			.where(
				and(
					eq(bookProgressHistory.bookId, input.bookId),
					eq(bookProgressHistory.progressPercent, input.progressPercent)
				)
			)
			.orderBy(desc(bookProgressHistory.recordedAt))
			.limit(1);

		if (!existing) {
			throw new Error('Failed to append progress history snapshot');
		}

		this.repoLogger.info(
			{
				event: 'book.progress_history.append.skipped_conflict',
				bookId: existing.bookId,
				progressPercent: existing.progressPercent,
				recordedAt: existing.recordedAt
			},
			'Skipped duplicate-timestamp progress history snapshot'
		);

		return existing;
	}

	async getByBookId(bookId: number): Promise<BookProgressHistory[]> {
		return drizzleDb
			.select()
			.from(bookProgressHistory)
			.where(eq(bookProgressHistory.bookId, bookId))
			.orderBy(desc(bookProgressHistory.recordedAt));
	}
}
