import { createClient } from '@libsql/client';
import { resolveLibsqlConfig } from '../../src/lib/server/config/infrastructure.shared.js';

const libsql = resolveLibsqlConfig(process.env);
const db = createClient({
	url: libsql.url,
	...(libsql.authToken ? { authToken: libsql.authToken } : {})
});

try {
	const result = await db.execute(`
		SELECT id, hash, created_at
		FROM __drizzle_migrations
		ORDER BY created_at DESC
		LIMIT 10
	`);

	if (!result.rows.length) {
		console.log('No rows found in __drizzle_migrations');
		process.exit(0);
	}

	console.log('__drizzle_migrations (latest 10):');
	for (const row of result.rows) {
		console.log(`id=${row.id} created_at=${row.created_at} hash=${row.hash}`);
	}
} catch (error) {
	console.error(
		`Failed to query __drizzle_migrations: ${error instanceof Error ? error.message : String(error)}`
	);
	process.exit(1);
}
