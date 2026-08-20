import type {
	AnnotationCursor,
	AnnotationIndexCandidate,
	AnnotationPage,
	AnnotationRepositoryPort
} from '$lib/server/application/ports/AnnotationRepositoryPort';
import type {
	AnnotationFacetsResponse,
	AnnotationHubItem,
	AnnotationIndexSummary,
	AnnotationQuery
} from '$lib/types/Annotations/Annotation';
import {
	createAnnotationVersion,
	HIGHLIGHT_COLORS,
	type ReaderAnnotation
} from '$lib/koreader/koreaderSidecar';
import { drizzleDb } from '$lib/server/infrastructure/db/client';
import {
	bookAnnotationIndexes,
	bookAnnotations,
	books,
	bookShelves,
	shelves
} from '$lib/server/infrastructure/db/schema';
import {
	and,
	asc,
	count,
	desc,
	eq,
	gt,
	gte,
	isNotNull,
	isNull,
	inArray,
	lt,
	lte,
	ne,
	notInArray,
	or,
	sql,
	type SQL
} from 'drizzle-orm';

const recency = sql<string>`coalesce(${bookAnnotations.updatedAt}, ${bookAnnotations.recordedAt})`;
const normalizedTitle = sql<string>`lower(${books.title})`;
const normalizedBookPosition = sql<string>`lower(${books.title}) || char(31) || ${bookAnnotations.page}`;

const selection = {
	id: bookAnnotations.id,
	version: bookAnnotations.version,
	sourceId: bookAnnotations.sourceId,
	kind: bookAnnotations.kind,
	page: bookAnnotations.page,
	pos0: bookAnnotations.pos0,
	pos1: bookAnnotations.pos1,
	text: bookAnnotations.text,
	note: bookAnnotations.note,
	chapter: bookAnnotations.chapter,
	drawer: bookAnnotations.drawer,
	color: bookAnnotations.color,
	recordedAt: bookAnnotations.recordedAt,
	updatedAt: bookAnnotations.updatedAt,
	bookId: books.id,
	bookTitle: books.title,
	bookAuthor: books.author,
	bookCover: books.cover,
	bookExtension: books.extension,
	bookArchivedAt: books.archivedAt
};

type SelectedAnnotation = {
	id: number;
	version: string;
	sourceId: string;
	kind: 'bookmark' | 'highlight';
	page: string;
	pos0: string | null;
	pos1: string | null;
	text: string | null;
	note: string | null;
	chapter: string | null;
	drawer: string | null;
	color: string | null;
	recordedAt: string;
	updatedAt: string | null;
	bookId: number;
	bookTitle: string;
	bookAuthor: string | null;
	bookCover: string | null;
	bookExtension: string | null;
	bookArchivedAt: string | null;
};

function mapItem(row: SelectedAnnotation): AnnotationHubItem {
	return {
		id: row.id,
		version: row.version,
		kind: row.kind,
		page: row.page,
		pos0: row.pos0,
		pos1: row.pos1,
		text: row.text,
		note: row.note,
		chapter: row.chapter,
		drawer: row.drawer,
		color: row.color,
		recordedAt: row.recordedAt,
		updatedAt: row.updatedAt,
		book: {
			id: row.bookId,
			title: row.bookTitle,
			author: row.bookAuthor,
			cover: row.bookCover,
			extension: row.bookExtension,
			isArchived: row.bookArchivedAt !== null
		}
	};
}

function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function filterConditions(query: AnnotationQuery): SQL[] {
	const conditions: SQL[] = [isNull(books.deletedAt)];
	if (query.q) {
		const pattern = `%${escapeLike(query.q.toLowerCase())}%`;
		conditions.push(sql`(
			lower(coalesce(${bookAnnotations.text}, '')) LIKE ${pattern} ESCAPE '\\'
			OR lower(coalesce(${bookAnnotations.note}, '')) LIKE ${pattern} ESCAPE '\\'
			OR lower(coalesce(${bookAnnotations.chapter}, '')) LIKE ${pattern} ESCAPE '\\'
			OR lower(${books.title}) LIKE ${pattern} ESCAPE '\\'
			OR lower(coalesce(${books.author}, '')) LIKE ${pattern} ESCAPE '\\'
		)`);
	}
	if (query.type === 'highlight' || query.type === 'bookmark') {
		conditions.push(eq(bookAnnotations.kind, query.type));
	} else if (query.type === 'with-note') {
		conditions.push(and(isNotNull(bookAnnotations.note), ne(bookAnnotations.note, ''))!);
	}
	if (query.bookId !== null) conditions.push(eq(bookAnnotations.bookId, query.bookId));
	if (query.shelfId !== null) {
		conditions.push(sql`exists (
			select 1 from ${bookShelves}
			where ${bookShelves.bookId} = ${bookAnnotations.bookId}
			and ${bookShelves.shelfId} = ${query.shelfId}
		)`);
	}
	if (query.color) conditions.push(eq(bookAnnotations.color, query.color));
	if (query.from) conditions.push(gte(recency, `${query.from} 00:00:00`));
	if (query.to) conditions.push(lte(recency, `${query.to} 23:59:59`));
	return conditions;
}

function cursorCondition(query: AnnotationQuery, cursor: AnnotationCursor): SQL {
	if (query.sort === 'newest') {
		return or(lt(recency, cursor.primary), and(eq(recency, cursor.primary), lt(bookAnnotations.id, cursor.id)))!;
	}
	if (query.sort === 'oldest') {
		return or(gt(recency, cursor.primary), and(eq(recency, cursor.primary), gt(bookAnnotations.id, cursor.id)))!;
	}
	return or(
		gt(normalizedBookPosition, cursor.primary),
		and(eq(normalizedBookPosition, cursor.primary), gt(bookAnnotations.id, cursor.id))
	)!;
}

function orderFor(query: AnnotationQuery) {
	if (query.sort === 'oldest') return [asc(recency), asc(bookAnnotations.id)] as const;
	if (query.sort === 'book') return [asc(normalizedTitle), asc(bookAnnotations.page), asc(bookAnnotations.id)] as const;
	return [desc(recency), desc(bookAnnotations.id)] as const;
}

function cursorFor(item: AnnotationHubItem, sort: AnnotationQuery['sort']): AnnotationCursor {
	return {
		primary:
			sort === 'book'
				? `${item.book.title.toLowerCase()}\u001f${item.page}`
				: (item.updatedAt ?? item.recordedAt),
		id: item.id
	};
}

export class AnnotationRepository implements AnnotationRepositoryPort {
	async replaceForBook(input: {
		bookId: number;
		annotations: ReaderAnnotation[];
		sourceProgressUpdatedAt: string | null;
		parserVersion: number;
	}): Promise<void> {
		const now = new Date().toISOString();
		await drizzleDb.transaction(async (tx) => {
			if (input.annotations.length > 0) {
				const values = input.annotations.map((annotation) => ({
						bookId: input.bookId,
						sourceId: annotation.id,
						kind: annotation.kind,
						page: annotation.page,
						pos0: annotation.pos0 ?? null,
						pos1: annotation.pos1 ?? null,
						text: annotation.text ?? null,
						note: annotation.note ?? null,
						chapter: annotation.chapter ?? null,
						drawer: annotation.drawer ?? null,
						color: annotation.color ?? null,
						recordedAt: annotation.datetime,
						updatedAt: annotation.datetimeUpdated ?? null,
						version: createAnnotationVersion(annotation)
					}));
				await tx
					.insert(bookAnnotations)
					.values(values)
					.onConflictDoUpdate({
						target: [bookAnnotations.bookId, bookAnnotations.sourceId],
						set: {
							kind: sql`excluded.kind`,
							page: sql`excluded.page`,
							pos0: sql`excluded.pos0`,
							pos1: sql`excluded.pos1`,
							text: sql`excluded.text`,
							note: sql`excluded.note`,
							chapter: sql`excluded.chapter`,
							drawer: sql`excluded.drawer`,
							color: sql`excluded.color`,
							recordedAt: sql`excluded.recorded_at`,
							updatedAt: sql`excluded.updated_at`,
							version: sql`excluded.version`
						}
					});
				await tx.delete(bookAnnotations).where(
					and(
						eq(bookAnnotations.bookId, input.bookId),
						notInArray(
							bookAnnotations.sourceId,
							input.annotations.map((annotation) => annotation.id)
						)
					)
				);
			} else {
				await tx.delete(bookAnnotations).where(eq(bookAnnotations.bookId, input.bookId));
			}
			await tx
				.insert(bookAnnotationIndexes)
				.values({
					bookId: input.bookId,
					sourceProgressUpdatedAt: input.sourceProgressUpdatedAt,
					parserVersion: input.parserVersion,
					status: 'indexed',
					indexedAt: now,
					attemptedAt: now,
					error: null
				})
				.onConflictDoUpdate({
					target: bookAnnotationIndexes.bookId,
					set: {
						sourceProgressUpdatedAt: input.sourceProgressUpdatedAt,
						parserVersion: input.parserVersion,
						status: 'indexed',
						indexedAt: now,
						attemptedAt: now,
						error: null
					}
				});
		});
	}

	async markFailed(input: {
		bookId: number;
		sourceProgressUpdatedAt: string | null;
		parserVersion: number;
		error: string;
	}): Promise<void> {
		const attemptedAt = new Date().toISOString();
		await drizzleDb
			.insert(bookAnnotationIndexes)
			.values({
				bookId: input.bookId,
				sourceProgressUpdatedAt: input.sourceProgressUpdatedAt,
				parserVersion: input.parserVersion,
				status: 'failed',
				indexedAt: null,
				attemptedAt,
				error: input.error.slice(0, 500)
			})
			.onConflictDoUpdate({
				target: bookAnnotationIndexes.bookId,
				set: {
					sourceProgressUpdatedAt: input.sourceProgressUpdatedAt,
					parserVersion: input.parserVersion,
					status: 'failed',
					attemptedAt,
					error: input.error.slice(0, 500)
				}
			});
	}

	async list(query: AnnotationQuery, cursor: AnnotationCursor | null): Promise<AnnotationPage> {
		const base = filterConditions(query);
		const conditions = cursor ? [...base, cursorCondition(query, cursor)] : base;
		const rows = await drizzleDb
			.select(selection)
			.from(bookAnnotations)
			.innerJoin(books, eq(bookAnnotations.bookId, books.id))
			.where(and(...conditions))
			.orderBy(...orderFor(query))
			.limit(query.limit + 1);
		const [{ value: total } = { value: 0 }] = await drizzleDb
			.select({ value: count() })
			.from(bookAnnotations)
			.innerJoin(books, eq(bookAnnotations.bookId, books.id))
			.where(and(...base));
		return {
			items: rows.slice(0, query.limit).map((row) => mapItem(row as SelectedAnnotation)),
			total,
			hasMore: rows.length > query.limit
		};
	}

	async getById(id: number): Promise<AnnotationHubItem | undefined> {
		const [row] = await drizzleDb
			.select(selection)
			.from(bookAnnotations)
			.innerJoin(books, eq(bookAnnotations.bookId, books.id))
			.where(and(eq(bookAnnotations.id, id), isNull(books.deletedAt)))
			.limit(1);
		return row ? mapItem(row as SelectedAnnotation) : undefined;
	}

	async getSourceId(id: number): Promise<string | undefined> {
		const [row] = await drizzleDb
			.select({ sourceId: bookAnnotations.sourceId })
			.from(bookAnnotations)
			.where(eq(bookAnnotations.id, id))
			.limit(1);
		return row?.sourceId;
	}

	async getFacets(): Promise<AnnotationFacetsResponse> {
		const active = isNull(books.deletedAt);
		const [bookRows, colorRows, typeRows, shelfRows] = await Promise.all([
			drizzleDb
				.select({ id: books.id, label: books.title, value: count() })
				.from(bookAnnotations)
				.innerJoin(books, eq(bookAnnotations.bookId, books.id))
				.where(active)
				.groupBy(books.id, books.title)
				.orderBy(asc(books.title)),
			drizzleDb
				.select({ id: bookAnnotations.color, value: count() })
				.from(bookAnnotations)
				.innerJoin(books, eq(bookAnnotations.bookId, books.id))
				.where(and(active, inArray(bookAnnotations.color, HIGHLIGHT_COLORS)))
				.groupBy(bookAnnotations.color)
				.orderBy(asc(bookAnnotations.color)),
			drizzleDb
				.select({ id: bookAnnotations.kind, value: count() })
				.from(bookAnnotations)
				.innerJoin(books, eq(bookAnnotations.bookId, books.id))
				.where(active)
				.groupBy(bookAnnotations.kind),
			drizzleDb
				.select({ id: shelves.id, label: shelves.name, value: count() })
				.from(bookAnnotations)
				.innerJoin(books, eq(bookAnnotations.bookId, books.id))
				.innerJoin(bookShelves, eq(bookAnnotations.bookId, bookShelves.bookId))
				.innerJoin(shelves, eq(bookShelves.shelfId, shelves.id))
				.where(active)
				.groupBy(shelves.id, shelves.name)
				.orderBy(asc(shelves.name))
		]);
		return {
			books: bookRows.map((row) => ({ id: row.id, label: row.label, count: row.value })),
			shelves: shelfRows.map((row) => ({ id: row.id, label: row.label, count: row.value })),
			colors: colorRows.flatMap((row) =>
				row.id ? [{ id: row.id, label: row.id, count: row.value }] : []
			),
			types: typeRows.map((row) => ({ id: row.id, label: row.id, count: row.value }))
		};
	}

	async getIndexSummary(parserVersion: number): Promise<AnnotationIndexSummary> {
		const base = and(isNull(books.deletedAt), isNotNull(books.progressStorageKey));
		const [[totalRow], [indexedRow], [failedRow]] = await Promise.all([
			drizzleDb.select({ value: count() }).from(books).where(base),
			drizzleDb
				.select({ value: count() })
				.from(books)
				.innerJoin(bookAnnotationIndexes, eq(books.id, bookAnnotationIndexes.bookId))
				.where(
					and(
						base,
						eq(bookAnnotationIndexes.status, 'indexed'),
						eq(bookAnnotationIndexes.parserVersion, parserVersion),
							sql`${bookAnnotationIndexes.sourceProgressUpdatedAt} IS ${books.progressUpdatedAt}`
					)
				),
			drizzleDb
				.select({ value: count() })
				.from(books)
				.innerJoin(bookAnnotationIndexes, eq(books.id, bookAnnotationIndexes.bookId))
				.where(and(base, eq(bookAnnotationIndexes.status, 'failed')))
		]);
		const totalBooks = totalRow?.value ?? 0;
		const indexedBooks = indexedRow?.value ?? 0;
		const failedBooks = failedRow?.value ?? 0;
		return {
			totalBooks,
			indexedBooks,
			failedBooks,
			pendingBooks: Math.max(0, totalBooks - indexedBooks - failedBooks),
			isReconciling: false
		};
	}

	async listIndexCandidates(
		parserVersion: number,
		bookId?: number
	): Promise<AnnotationIndexCandidate[]> {
		const stale = or(
			isNull(bookAnnotationIndexes.bookId),
			eq(bookAnnotationIndexes.status, 'failed'),
			ne(bookAnnotationIndexes.parserVersion, parserVersion),
				sql`${bookAnnotationIndexes.sourceProgressUpdatedAt} IS NOT ${books.progressUpdatedAt}`
		);
		const conditions = [
			isNull(books.deletedAt),
			isNotNull(books.progressStorageKey),
			stale!
		];
		if (bookId !== undefined) conditions.push(eq(books.id, bookId));
		const rows = await drizzleDb
			.select({
				bookId: books.id,
				storageKey: books.s3StorageKey,
				progressStorageKey: books.progressStorageKey,
				progressUpdatedAt: books.progressUpdatedAt
			})
			.from(books)
			.leftJoin(bookAnnotationIndexes, eq(books.id, bookAnnotationIndexes.bookId))
			.where(and(...conditions))
			.orderBy(asc(books.id));
		return rows.flatMap((row) =>
			row.progressStorageKey
				? [{ ...row, progressStorageKey: row.progressStorageKey }]
				: []
		);
	}

	async *listAllForExport(query: AnnotationQuery): AsyncIterable<AnnotationHubItem> {
		let cursor: AnnotationCursor | null = null;
		const pageQuery = { ...query, cursor: null, limit: 100 };
		do {
			const page = await this.list(pageQuery, cursor);
			for (const item of page.items) yield item;
			if (!page.hasMore || page.items.length === 0) return;
			cursor = cursorFor(page.items.at(-1)!, query.sort);
		} while (cursor);
	}
}
