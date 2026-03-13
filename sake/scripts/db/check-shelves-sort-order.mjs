import { createClient } from '@libsql/client';
import { resolveLibsqlConfig } from '../../src/lib/server/config/infrastructure.shared.js';

const libsql = resolveLibsqlConfig(process.env);
const db = createClient({
	url: libsql.url,
	...(libsql.authToken ? { authToken: libsql.authToken } : {})
});

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

	console.log(`[db:shelves:check] target=${toHost(libsql.url)}`);
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
