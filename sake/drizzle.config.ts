import type { Config } from 'drizzle-kit';
import { resolveLibsqlConfig } from './src/lib/server/config/infrastructure.shared.js';

const libsql = resolveLibsqlConfig(process.env);

export default {
	schema: './src/lib/server/infrastructure/db/schema.ts',
	out: './drizzle',
	dialect: 'turso',
	dbCredentials: {
		url: libsql.url,
		authToken: libsql.authToken
	}
} satisfies Config;
