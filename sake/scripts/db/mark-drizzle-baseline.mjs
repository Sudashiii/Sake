import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { resolveLibsqlConfig } from '../../src/lib/server/config/infrastructure.shared.js';

const DRIZZLE_MIGRATIONS_TABLE = '__drizzle_migrations';
const REQUIRED_APP_TABLES = ['Books', 'DeviceDownloads'];

function readBaselineMigration(repoRoot) {
	const journalPath = path.join(repoRoot, 'drizzle', 'meta', '_journal.json');
	if (!fs.existsSync(journalPath)) {
		throw new Error(`Missing Drizzle journal file: ${journalPath}`);
	}

	const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
	if (!Array.isArray(journal.entries) || journal.entries.length === 0) {
		throw new Error('No migration entries found in drizzle/meta/_journal.json');
	}

	const baselineEntry = [...journal.entries].sort((a, b) => a.when - b.when)[0];
	const migrationFile = path.join(repoRoot, 'drizzle', `${baselineEntry.tag}.sql`);
	if (!fs.existsSync(migrationFile)) {
		throw new Error(`Missing migration SQL file: ${migrationFile}`);
	}

	const sql = fs.readFileSync(migrationFile, 'utf8');
	const hash = crypto.createHash('sha256').update(sql).digest('hex');

	return {
		tag: baselineEntry.tag,
		createdAt: Number(baselineEntry.when),
		hash
	};
}

function assertEnv() {
	return resolveLibsqlConfig(process.env);
}

async function ensureAppTablesExist(db) {
	const placeholders = REQUIRED_APP_TABLES.map(() => '?').join(', ');
	const result = await db.execute({
		sql: `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`,
		args: REQUIRED_APP_TABLES
	});

	const found = new Set(result.rows.map((row) => String(row.name)));
	const missing = REQUIRED_APP_TABLES.filter((table) => !found.has(table));
	if (missing.length > 0) {
		throw new Error(
			`Refusing baseline mark: expected existing tables missing (${missing.join(', ')}). ` +
			'This script is only for already-migrated databases.'
		);
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

async function markBaseline(db, baseline) {
	await db.execute({
		sql: `INSERT INTO ${DRIZZLE_MIGRATIONS_TABLE} (hash, created_at) VALUES (?, ?)`,
		args: [baseline.hash, baseline.createdAt]
	});
}

async function main() {
	const repoRoot = process.cwd();
	const baseline = readBaselineMigration(repoRoot);
	const libsql = assertEnv();
	const db = createClient({
		url: libsql.url,
		...(libsql.authToken ? { authToken: libsql.authToken } : {})
	});

	console.log(`[baseline] Target migration: ${baseline.tag} (${baseline.createdAt})`);

	await ensureAppTablesExist(db);
	await ensureDrizzleMigrationsTable(db);

	const existingBaseline = await getMigrationByCreatedAt(db, baseline.createdAt);
	if (existingBaseline) {
		if (String(existingBaseline.hash) !== baseline.hash) {
			throw new Error(
				`Baseline created_at exists with different hash. DB hash=${existingBaseline.hash} expected=${baseline.hash}`
			);
		}
		console.log('[baseline] Already marked. No changes made.');
		return;
	}

	const latest = await getLatestDrizzleMigration(db);
	if (latest && Number(latest.created_at) > baseline.createdAt) {
		console.log(
			'[baseline] Newer Drizzle migration already exists in DB. Skipping baseline insert.'
		);
		return;
	}

	await markBaseline(db, baseline);
	console.log('[baseline] Baseline marked successfully.');
}

main().catch((error) => {
	console.error(`[baseline] ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
});
