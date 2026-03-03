import type { ShelfRepositoryPort } from '$lib/server/application/ports/ShelfRepositoryPort';
import type {
	CreateShelfInput,
	Shelf,
	UpdateShelfInput
} from '$lib/server/domain/entities/Shelf';
import { drizzleDb } from '$lib/server/infrastructure/db/client';
import { bookShelves, shelves } from '$lib/server/infrastructure/db/schema';
import { createChildLogger } from '$lib/server/infrastructure/logging/logger';
import {
	createEmptyRuleGroup,
	isRuleGroup,
	type RuleGroup
} from '$lib/types/Library/ShelfRule';
import { eq, inArray } from 'drizzle-orm';

function mapShelfRow(row: {
	id: number;
	name: string;
	icon: string;
	ruleGroupJson: string;
	createdAt: string;
	updatedAt: string;
}): Shelf {
	return {
		id: row.id,
		name: row.name,
		icon: row.icon,
		ruleGroup: deserializeRuleGroup(row.ruleGroupJson),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

function deserializeRuleGroup(raw: string): RuleGroup {
	try {
		const parsed: unknown = JSON.parse(raw);
		if (isRuleGroup(parsed)) {
			return parsed;
		}
	} catch {
		// noop
	}
	return createEmptyRuleGroup();
}

export class ShelfRepository implements ShelfRepositoryPort {
	private readonly repoLogger = createChildLogger({ repository: 'ShelfRepository' });

	async list(): Promise<Shelf[]> {
		const rows = await drizzleDb
			.select({
				id: shelves.id,
				name: shelves.name,
				icon: shelves.icon,
				ruleGroupJson: shelves.ruleGroupJson,
				createdAt: shelves.createdAt,
				updatedAt: shelves.updatedAt
			})
			.from(shelves)
			.orderBy(shelves.name);
		return rows.map((row) => mapShelfRow(row));
	}

	async listByIds(ids: number[]): Promise<Shelf[]> {
		if (ids.length === 0) {
			return [];
		}

		const rows = await drizzleDb
			.select({
				id: shelves.id,
				name: shelves.name,
				icon: shelves.icon,
				ruleGroupJson: shelves.ruleGroupJson,
				createdAt: shelves.createdAt,
				updatedAt: shelves.updatedAt
			})
			.from(shelves)
			.where(inArray(shelves.id, ids));
		return rows.map((row) => mapShelfRow(row));
	}

	async getById(id: number): Promise<Shelf | undefined> {
		const [row] = await drizzleDb
			.select({
				id: shelves.id,
				name: shelves.name,
				icon: shelves.icon,
				ruleGroupJson: shelves.ruleGroupJson,
				createdAt: shelves.createdAt,
				updatedAt: shelves.updatedAt
			})
			.from(shelves)
			.where(eq(shelves.id, id))
			.limit(1);
		return row ? mapShelfRow(row) : undefined;
	}

	async create(input: CreateShelfInput): Promise<Shelf> {
		const now = new Date().toISOString();
		const [created] = await drizzleDb
			.insert(shelves)
			.values({
				name: input.name,
				icon: input.icon,
				ruleGroupJson: JSON.stringify(input.ruleGroup),
				createdAt: now,
				updatedAt: now
			})
			.returning({
				id: shelves.id,
				name: shelves.name,
				icon: shelves.icon,
				ruleGroupJson: shelves.ruleGroupJson,
				createdAt: shelves.createdAt,
				updatedAt: shelves.updatedAt
			});

		if (!created) {
			throw new Error('Failed to create shelf');
		}

		this.repoLogger.info(
			{ event: 'shelf.created', shelfId: created.id, name: created.name },
			'Shelf row inserted'
		);

		return mapShelfRow(created);
	}

	async update(id: number, input: UpdateShelfInput): Promise<Shelf | undefined> {
		const [updated] = await drizzleDb
			.update(shelves)
			.set({
				name: input.name,
				icon: input.icon,
				ruleGroupJson: JSON.stringify(input.ruleGroup),
				updatedAt: new Date().toISOString()
			})
			.where(eq(shelves.id, id))
			.returning({
				id: shelves.id,
				name: shelves.name,
				icon: shelves.icon,
				ruleGroupJson: shelves.ruleGroupJson,
				createdAt: shelves.createdAt,
				updatedAt: shelves.updatedAt
			});

		if (!updated) {
			return undefined;
		}

		this.repoLogger.info({ event: 'shelf.updated', shelfId: id, name: updated.name }, 'Shelf row updated');
		return mapShelfRow(updated);
	}

	async delete(id: number): Promise<void> {
		await drizzleDb.delete(shelves).where(eq(shelves.id, id));
		this.repoLogger.info({ event: 'shelf.deleted', shelfId: id }, 'Shelf row deleted');
	}

	async getBookShelfIds(bookId: number): Promise<number[]> {
		const rows = await drizzleDb
			.select({ shelfId: bookShelves.shelfId })
			.from(bookShelves)
			.where(eq(bookShelves.bookId, bookId));

		return rows.map((row) => row.shelfId).sort((a, b) => a - b);
	}

	async getBookShelfIdsForBooks(bookIds: number[]): Promise<Record<number, number[]>> {
		const result: Record<number, number[]> = {};
		for (const bookId of bookIds) {
			result[bookId] = [];
		}

		if (bookIds.length === 0) {
			return result;
		}

		const rows = await drizzleDb
			.select({
				bookId: bookShelves.bookId,
				shelfId: bookShelves.shelfId
			})
			.from(bookShelves)
			.where(inArray(bookShelves.bookId, bookIds));

		for (const row of rows) {
			if (!result[row.bookId]) {
				result[row.bookId] = [];
			}
			result[row.bookId].push(row.shelfId);
		}

		for (const bookId of Object.keys(result)) {
			result[Number(bookId)].sort((a, b) => a - b);
		}

		return result;
	}

	async setBookShelfIds(bookId: number, shelfIds: number[]): Promise<void> {
		const uniqueShelfIds = [...new Set(shelfIds)].sort((a, b) => a - b);
		const now = new Date().toISOString();

		await drizzleDb.transaction(async (tx) => {
			await tx.delete(bookShelves).where(eq(bookShelves.bookId, bookId));
			if (uniqueShelfIds.length === 0) {
				return;
			}

			await tx.insert(bookShelves).values(
				uniqueShelfIds.map((shelfId) => ({
					bookId,
					shelfId,
					createdAt: now
				}))
			);
		});

		this.repoLogger.info(
			{ event: 'book.shelves.updated', bookId, shelfIds: uniqueShelfIds },
			'Book shelf membership updated'
		);
	}
}
