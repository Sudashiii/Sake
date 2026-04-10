import type { RequestEvent } from '@sveltejs/kit';
import { userRepository } from '$lib/server/application/composition';
import { verifyPassword } from '$lib/server/application/services/LocalAuthService';

function unauthorizedResponse(realm: string): Response {
	return new Response('Unauthorized', {
		status: 401,
		headers: {
			'WWW-Authenticate': `Basic realm="${realm}"`
		}
	});
}

export async function requireBasicAuth(
	event: RequestEvent,
	realm: string
): Promise<Response | null> {
	const authHeader = event.request.headers.get('authorization');
	if (!authHeader || !authHeader.startsWith('Basic ')) {
		return unauthorizedResponse(realm);
	}

	const base64Credentials = authHeader.substring(6);
	const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
	const [username, ...passwordParts] = credentials.split(':');
	const password = passwordParts.join(':');

	if (!username || !password) {
		return unauthorizedResponse(realm);
	}

	const user = await userRepository.getByUsername(username);
	if (!user || user.isDisabled) {
		return unauthorizedResponse(realm);
	}

	const passwordMatches = await verifyPassword(password, user.passwordHash);
	if (passwordMatches) {
		return null;
	}

	if (!user.basicAuthPasswordHash) {
		return unauthorizedResponse(realm);
	}

	const basicPasswordMatches = await verifyPassword(password, user.basicAuthPasswordHash);
	if (!basicPasswordMatches) {
		return unauthorizedResponse(realm);
	}

	return null;
}
