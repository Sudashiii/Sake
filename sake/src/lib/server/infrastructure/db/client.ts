import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { getLibsqlConfig } from '$lib/server/config/infrastructure';

import * as schema from './schema';

const libsql = getLibsqlConfig();

const client = createClient({
	url: libsql.url,
	...(libsql.authToken ? { authToken: libsql.authToken } : {})
});

export const drizzleDb = drizzle(client, { schema });
