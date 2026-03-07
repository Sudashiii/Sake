import { env } from '$env/dynamic/private';

function parseEnvList(value: string | undefined): string[] {
	return (value ?? '')
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

function getLegacyUsers(): string[] {
	const pluralUsers = parseEnvList(env.USERS);
	if (pluralUsers.length > 0) {
		return pluralUsers;
	}

	return parseEnvList(env.USER);
}

function getLegacyPasswords(): string[] {
	const pluralPasswords = parseEnvList(env.PASSWORDS);
	if (pluralPasswords.length > 0) {
		return pluralPasswords;
	}

	return parseEnvList(env.PASSWORD);
}

export function hasLegacyBasicAuthConfigured(): boolean {
	const validUsers = getLegacyUsers();
	const validPasswords = getLegacyPasswords();
	return validUsers.length > 0 && validUsers.length === validPasswords.length;
}

export function matchesLegacyBasicAuth(username: string, password: string): boolean {
	const validUsers = getLegacyUsers();
	const validPasswords = getLegacyPasswords();

	if (validUsers.length === 0 || validUsers.length !== validPasswords.length) {
		return false;
	}

	return validUsers.some((user, index) => user === username && validPasswords[index] === password);
}

/**
 * Legacy Basic Auth check retained only for guarded bootstrap / migration flows.
 * Throws a Response if auth fails (SvelteKit style).
 */
export function requireLegacyBasicAuth(request: Request): void {
	const validUsers = getLegacyUsers();
	const validPasswords = getLegacyPasswords();

	if (validUsers.length === 0 || validUsers.length !== validPasswords.length) {
		throw new Response(JSON.stringify({ error: 'Legacy bootstrap authentication is not configured' }), {
			status: 401,
			headers: {
				'WWW-Authenticate': 'Basic realm="Sake Bootstrap"',
				'Content-Type': 'application/json'
			}
		});
	}

	const authHeader = request.headers.get('authorization');
	if (!authHeader || !authHeader.startsWith('Basic ')) {
		throwUnauthorized();
	}

	const base64Credentials = authHeader.split(' ')[1];
	const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
	const separatorIndex = credentials.indexOf(':');
	const username = separatorIndex >= 0 ? credentials.slice(0, separatorIndex) : credentials;
	const password = separatorIndex >= 0 ? credentials.slice(separatorIndex + 1) : '';

	const isAuthorized = matchesLegacyBasicAuth(username, password);

	if (!isAuthorized) {
		throwUnauthorized();
	}
}

function throwUnauthorized(): never {
	throw new Response(JSON.stringify({ error: 'Legacy bootstrap authentication required' }), {
		status: 401,
		headers: {
			'WWW-Authenticate': 'Basic realm="Sake Bootstrap"',
			'Content-Type': 'application/json'
		}
	});
}
