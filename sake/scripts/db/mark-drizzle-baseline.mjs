import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { resolveLibsqlConfig } from '../../src/lib/server/config/infrastructure.shared.js';

const DRIZZLE_MIGRATIONS_TABLE = '__drizzle_migrations';
const REQUIRED_SCHEMA_GUARDS = [
	{
		table: 'Books',
		columns: ['id', 'series_index', 'month', 'day']
	},
	{
		table: 'DeviceDownloads',
		columns: ['id', 'deviceId', 'bookId']
	},
	{
		table: 'QueueJobs',
		columns: ['id', 'user_id', 'series_index']
	},
	{
		table: 'Users',
		columns: ['id', 'username', 'password_hash']
	},
	{
		table: 'UserSessions',
		columns: ['id', 'user_id', 'token_hash']
	},
	{
		table: 'UserApiKeys',
		columns: ['id', 'user_id', 'scope', 'key_hash']
	},
	{
		table: 'Devices',
		columns: ['id', 'user_id', 'device_id']
	},
	{
		table: 'Shelves',
		columns: ['id', 'name', 'sort_order']
	},
	{
		table: 'BookShelves',
		columns: ['id', 'book_id', 'shelf_id']
	},
	{
		table: 'PluginReleases',
		columns: ['id', 'version', 'storage_key']
	},
	{
		table: 'BookProgressHistory',
		columns: ['id', 'book_id', 'recorded_at']
	}
];

function readLatestMigration(repoRoot) {
	const journalPath = path.join(repoRoot, 'drizzle', 'meta', '_journal.json');
	if (!fs.existsSync(journalPath)) {
		throw new Error(`Missing Drizzle journal file: ${journalPath}`);
	}

	const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
	if (!Array.isArray(journal.entries) || journal.entries.length === 0) {
		throw new Error('No migration entries found in drizzle/meta/_journal.json');
	}

	const latestEntry = [...journal.entries].sort((a, b) => a.when - b.when)[journal.entries.length - 1];
	const migrationFile = path.join(repoRoot, 'drizzle', `${latestEntry.tag}.sql`);
	if (!fs.existsSync(migrationFile)) {
		throw new Error(`Missing migration SQL file: ${migrationFile}`);
	}

	const sql = fs.readFileSync(migrationFile, 'utf8');
	const hash = crypto.createHash('sha256').update(sql).digest('hex');

	return {
		tag: latestEntry.tag,
		createdAt: Number(latestEntry.when),
		hash
	};
}

function assertEnv() {
	return resolveLibsqlConfig(process.env);
}

async function ensureAppTablesExist(db) {
	const requiredTables = REQUIRED_SCHEMA_GUARDS.map((guard) => guard.table);
	const placeholders = requiredTables.map(() => '?').join(', ');
	const result = await db.execute({
		sql: `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`,
		args: requiredTables
	});

	const found = new Set(result.rows.map((row) => String(row.name)));
	const missing = requiredTables.filter((table) => !found.has(table));
	if (missing.length > 0) {
		throw new Error(
			`Refusing migration-state mark: expected existing tables missing (${missing.join(', ')}). ` +
			'This script is only for databases that already match the latest schema.'
		);
	}
}

async function assertSchemaColumnsExist(db) {
	for (const guard of REQUIRED_SCHEMA_GUARDS) {
		const result = await db.execute(`PRAGMA table_info("${guard.table}")`);
		const foundColumns = new Set(result.rows.map((row) => String(row.name)));
		const missingColumns = guard.columns.filter((column) => !foundColumns.has(column));
		if (missingColumns.length > 0) {
			throw new Error(
				`Refusing migration-state mark: table ${guard.table} is missing expected columns (${missingColumns.join(', ')}). ` +
				'Apply the real migrations before marking the database as current.'
			);
		}
	}
}

async function ensureDrizzleMigrationsTable(db) {
	await db.execute(`
		CREATE TABLE IF NOT EXISTS ${DRIZZLE_MIGRATIONS_TABLE} (
			id SERIAL PRIMARY KEY,
			hash text NOT NULL,
			created_at numeric
		)
	`);
}

async function getLatestDrizzleMigration(db) {
	const result = await db.execute(`
		SELECT id, hash, created_at
		FROM ${DRIZZLE_MIGRATIONS_TABLE}
		ORDER BY created_at DESC
		LIMIT 1
	`);
	return result.rows[0] ?? null;
}

async function getMigrationByCreatedAt(db, createdAt) {
	const result = await db.execute({
		sql: `SELECT id, hash, created_at FROM ${DRIZZLE_MIGRATIONS_TABLE} WHERE created_at = ? LIMIT 1`,
		args: [createdAt]
	});
	return result.rows[0] ?? null;
}

async function markMigrationState(db, migration) {
	await db.execute({
		sql: `INSERT INTO ${DRIZZLE_MIGRATIONS_TABLE} (hash, created_at) VALUES (?, ?)`,
		args: [migration.hash, migration.createdAt]
	});
}

async function main() {
	const repoRoot = process.cwd();
	const latestMigration = readLatestMigration(repoRoot);
	const libsql = assertEnv();
	const db = createClient({
		url: libsql.url,
		...(libsql.authToken ? { authToken: libsql.authToken } : {})
	});

	console.log(
		`[migration-state] Target latest migration: ${latestMigration.tag} (${latestMigration.createdAt})`
	);

	await ensureAppTablesExist(db);
	await assertSchemaColumnsExist(db);
	await ensureDrizzleMigrationsTable(db);

	const existingMigration = await getMigrationByCreatedAt(db, latestMigration.createdAt);
	if (existingMigration) {
		if (String(existingMigration.hash) !== latestMigration.hash) {
			throw new Error(
				`Latest migration created_at exists with different hash. DB hash=${existingMigration.hash} expected=${latestMigration.hash}`
			);
		}
		console.log('[migration-state] Latest migration already recorded. No changes made.');
		return;
	}

	const latest = await getLatestDrizzleMigration(db);
	if (latest && Number(latest.created_at) > latestMigration.createdAt) {
		console.log(
			'[migration-state] Newer Drizzle migration already exists in DB. Skipping insert.'
		);
		return;
	}

	await markMigrationState(db, latestMigration);
	console.log('[migration-state] Latest migration marked successfully.');
}

main().catch((error) => {
	console.error(`[migration-state] ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
});
