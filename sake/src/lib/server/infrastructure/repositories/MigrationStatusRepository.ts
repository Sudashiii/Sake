import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { MigrationStatusPort, MigrationStatusSnapshot } from '$lib/server/application/ports/MigrationStatusPort';
import { drizzleDb } from '$lib/server/infrastructure/db/client';

const DRIZZLE_MIGRATIONS_TABLE = '__drizzle_migrations';

interface JournalEntryRecord {
	idx?: unknown;
	when?: unknown;
	tag?: unknown;
}

interface JournalFileRecord {
	entries?: JournalEntryRecord[];
}

interface ResolvedJournalEntry {
	idx: number;
	when: number;
	tag: string;
	hash: string;
}

interface JournalMetadata {
	latest: ResolvedJournalEntry;
	entryByWhen: Map<number, ResolvedJournalEntry>;
	entryByHash: Map<string, ResolvedJournalEntry>;
}

let cachedJournalMetadata: JournalMetadata | null = null;

function hasText(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function resolveProjectRoot(): string {
	return process.cwd();
}

function createMigrationHash(sql: string): string {
	return crypto.createHash('sha256').update(sql).digest('hex');
}

function loadJournalMetadata(): JournalMetadata {
	if (cachedJournalMetadata) {
		return cachedJournalMetadata;
	}

	const root = resolveProjectRoot();
	const journalPath = path.join(root, 'drizzle', 'meta', '_journal.json');
	if (!fs.existsSync(journalPath)) {
		throw new Error(`Missing Drizzle journal file: ${journalPath}`);
	}

	const raw = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as JournalFileRecord;
	if (!Array.isArray(raw.entries) || raw.entries.length === 0) {
		throw new Error('No migration entries found in drizzle/meta/_journal.json');
	}

	const entries = raw.entries
		.map((entry, fallbackIndex) => {
			const when = typeof entry.when === 'number' ? entry.when : Number.NaN;
			const tag = hasText(entry.tag) ? entry.tag.trim() : '';
			const idx = Number.isInteger(entry.idx) ? Number(entry.idx) : fallbackIndex;

			if (!Number.isFinite(when)) {
				throw new Error(`Invalid Drizzle journal entry timestamp for ${tag || `index ${fallbackIndex}`}`);
			}

			if (!tag) {
				throw new Error(`Invalid Drizzle journal entry tag at index ${fallbackIndex}`);
			}

			const migrationPath = path.join(root, 'drizzle', `${tag}.sql`);
			if (!fs.existsSync(migrationPath)) {
				throw new Error(`Missing migration SQL file: ${migrationPath}`);
			}

			return {
				idx,
				when,
				tag,
				hash: createMigrationHash(fs.readFileSync(migrationPath, 'utf8'))
			} satisfies ResolvedJournalEntry;
		})
		.sort((a, b) => a.when - b.when || a.idx - b.idx);

	const latest = entries[entries.length - 1];
	if (!latest) {
		throw new Error('No resolved Drizzle journal entries found');
	}

	cachedJournalMetadata = {
		latest,
		entryByWhen: new Map(entries.map((entry) => [entry.when, entry])),
		entryByHash: new Map(entries.map((entry) => [entry.hash, entry]))
	};

	return cachedJournalMetadata;
}

function resolveMigrationRow(row: Record<string, unknown> | null): {
	hash: string | null;
	createdAt: number | null;
} {
	if (!row) {
		return {
			hash: null,
			createdAt: null
		};
	}

	return {
		hash: hasText(row.hash) ? row.hash.trim() : null,
		createdAt:
			typeof row.created_at === 'number'
				? row.created_at
				: Number.isFinite(Number(row.created_at))
					? Number(row.created_at)
					: null
	};
}

export class MigrationStatusRepository implements MigrationStatusPort {
	private async hasMigrationTable(): Promise<boolean> {
		const result = await drizzleDb.$client.execute({
			sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
			args: [DRIZZLE_MIGRATIONS_TABLE]
		});

		return result.rows.length > 0;
	}

	private async getLatestMigrationRow(): Promise<Record<string, unknown> | null> {
		const result = await drizzleDb.$client.execute(`
			SELECT hash, created_at
			FROM __drizzle_migrations
			ORDER BY created_at DESC
			LIMIT 1
		`);

		return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
	}

	async getSnapshot(): Promise<MigrationStatusSnapshot> {
		const journal = loadJournalMetadata();
		const expectedMigrationTag = journal.latest.tag;
		const expectedMigrationIndex = journal.latest.idx;

		if (!(await this.hasMigrationTable())) {
			return {
				currentMigrationTag: null,
				expectedMigrationTag,
				currentMigrationIndex: null,
				expectedMigrationIndex
			};
		}

		const migration = resolveMigrationRow(await this.getLatestMigrationRow());
		if (migration.createdAt === null && migration.hash === null) {
			return {
				currentMigrationTag: null,
				expectedMigrationTag,
				currentMigrationIndex: null,
				expectedMigrationIndex
			};
		}

		const resolvedEntry =
			(migration.createdAt !== null ? journal.entryByWhen.get(migration.createdAt) : undefined) ??
			(migration.hash ? journal.entryByHash.get(migration.hash) : undefined);

		return {
			currentMigrationTag: resolvedEntry?.tag ?? null,
			expectedMigrationTag,
			currentMigrationIndex: resolvedEntry?.idx ?? null,
			expectedMigrationIndex
		};
	}
}
