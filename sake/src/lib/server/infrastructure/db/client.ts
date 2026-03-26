import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { getLibsqlConfig } from '$lib/server/config/infrastructure';
import { createLazySingleton } from '$lib/server/utils/createLazySingleton';

import * as schema from './schema';

function createDrizzleDb() {
	const libsql = getLibsqlConfig();
	const client = createClient({
		url: libsql.url,
		...(libsql.authToken ? { authToken: libsql.authToken } : {})
	});

	return drizzle(client, { schema });
}

type DrizzleDatabase = ReturnType<typeof createDrizzleDb>;

// Delay opening libSQL until the first real repository call so builds can analyse routes without infra.
export const drizzleDb = createLazySingleton<DrizzleDatabase>(createDrizzleDb);
