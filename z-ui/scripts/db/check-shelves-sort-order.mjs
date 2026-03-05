import { createClient } from '@libsql/client';

const url = process.env.TURSO_DB_URL;
const authToken = process.env.TURSO_DB_AUTH_TOKEN;

if (!url) {
	console.error('Missing TURSO_DB_URL');
	process.exit(1);
}

if (!authToken) {
	console.error('Missing TURSO_DB_AUTH_TOKEN');
	process.exit(1);
}

const db = createClient({ url, authToken });

function toHost(rawUrl) {
	try {
		return new URL(rawUrl).host;
	} catch {
		return rawUrl;
	}
}

try {
	const tableInfo = await db.execute(`PRAGMA table_info('Shelves')`);
	const columns = tableInfo.rows.map((row) => String(row.name));
	const hasSortOrder = columns.includes('sort_order');

	console.log(`[db:shelves:check] target=${toHost(url)}`);
	console.log(`[db:shelves:check] columns=${columns.join(', ')}`);
	console.log(`[db:shelves:check] sort_order_present=${hasSortOrder}`);

	if (!hasSortOrder) {
		process.exit(2);
	}
} catch (error) {
	console.error(
		`Failed to check Shelves schema: ${error instanceof Error ? error.message : String(error)}`
	);
	process.exit(1);
}
