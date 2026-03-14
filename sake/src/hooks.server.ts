import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { resolve as resolvePath } from '$app/paths';
import { resolveRequestAuthUseCase } from '$lib/server/application/composition';
import { SAKE_CLEAR_SESSION_HEADER_NAME } from '$lib/auth/responseSignals';
import {
	SAKE_API_KEY_HEADER_NAME,
	SAKE_SESSION_COOKIE_NAME,
	SAKE_VERSION_HEADER_NAME
} from '$lib/server/auth/constants';
import { clearSakeSessionCookie } from '$lib/server/auth/cookies';
import { isApiKeyAllowedRoute, isPublicApiRoute, isStaticAssetPath } from '$lib/server/auth/requestAccess';
import { errorResponse, withResponseHeader } from '$lib/server/http/api';
import {
	purgeExpiredTrashUseCase,
	reportDeviceVersionUseCase,
	syncKoreaderPluginReleaseUseCase
} from '$lib/server/application/composition';
import { createChildLogger, toLogError } from '$lib/server/infrastructure/logging/logger';
import { randomUUID } from 'node:crypto';
import { isSearchEnabled } from '$lib/server/config/activatedProviders';
import { isSearchFeatureApiPath } from '$lib/server/config/activatedProviders.shared';

const TRASH_PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;
let lastTrashPurgeStartedAt = 0;
let runningPurgePromise: Promise<void> | null = null;
let pluginSyncStarted = false;

function triggerTrashPurgeIfDue(): void {
	const now = Date.now();
	if (runningPurgePromise) {
		return;
	}

	if (now - lastTrashPurgeStartedAt < TRASH_PURGE_INTERVAL_MS) {
		return;
	}

	lastTrashPurgeStartedAt = now;
	runningPurgePromise = (async () => {
		const purgeLogger = createChildLogger({ event: 'trash.purge' });
		try {
			const result = await purgeExpiredTrashUseCase.execute();
			if (!result.ok) {
				purgeLogger.error({ error: result.error }, 'Trash purge failed');
			} else if (result.value.purgedBookIds.length > 0) {
				purgeLogger.info(
					{ purgedBookIds: result.value.purgedBookIds, count: result.value.purgedBookIds.length },
					'Purged expired trashed books'
				);
			}
		} catch (err: unknown) {
			purgeLogger.error({ error: toLogError(err) }, 'Trash purge failed');
		} finally {
			runningPurgePromise = null;
		}
	})();
}

function triggerPluginSyncOnStartup(): void {
	if (pluginSyncStarted) {
		return;
	}

	pluginSyncStarted = true;
	void (async () => {
		const pluginLogger = createChildLogger({ event: 'plugin.sync.startup' });
		try {
			const result = await syncKoreaderPluginReleaseUseCase.execute();
			if (!result.ok) {
				pluginLogger.error(
					{ statusCode: result.error.status, reason: result.error.message },
					'KOReader plugin startup sync rejected'
				);
				return;
			}

			pluginLogger.info(
				{
					version: result.value.version,
					storageKey: result.value.storageKey,
					uploaded: result.value.uploaded
				},
				'KOReader plugin startup sync finished'
			);
		} catch (err: unknown) {
			pluginLogger.error({ error: toLogError(err) }, 'KOReader plugin startup sync failed');
		}
	})();
}

triggerPluginSyncOnStartup();

async function syncDeviceVersionFromHeader(event: Parameters<Handle>[0]['event']): Promise<void> {
	if (event.locals.auth?.type !== 'api_key') {
		return;
	}

	const versionHeader = event.request.headers.get(SAKE_VERSION_HEADER_NAME)?.trim();
	if (!versionHeader) {
		return;
	}

	const result = await reportDeviceVersionUseCase.execute({
		userId: event.locals.auth.user.id,
		deviceId: event.locals.auth.deviceId,
		version: versionHeader,
		skipIfUnchanged: true
	});

	if (!result.ok) {
		event.locals.logger?.warn(
			{
				event: 'device.version.header_sync.rejected',
				deviceId: event.locals.auth.deviceId,
				version: versionHeader,
				statusCode: result.error.status,
				reason: result.error.message
			},
			'Device version header sync rejected'
		);
	}
}

const requestLogHandle: Handle = async ({ event, resolve }) => {
	const requestId = randomUUID();
	const start = Date.now();
	const requestLogger = createChildLogger({
		requestId,
		method: event.request.method,
		route: event.url.pathname
	});

	event.locals.requestId = requestId;
	event.locals.logger = requestLogger;

	requestLogger.info({ event: 'request.start' }, 'Request started');

	try {
		const response = await resolve(event);
		const durationMs = Date.now() - start;
		const responseWithRequestId = withResponseHeader(response, 'x-request-id', requestId);
		requestLogger.info(
			{
				event: 'request.finish',
				statusCode: responseWithRequestId.status,
				durationMs
			},
			'Request completed'
		);
		return responseWithRequestId;
	} catch (err: unknown) {
		requestLogger.error(
			{
				event: 'request.error',
				durationMs: Date.now() - start,
				error: toLogError(err)
			},
			'Request failed'
		);
		throw err;
	}
};

const cookieHandle: Handle = async ({ event, resolve }) => {
	triggerTrashPurgeIfDue();

	const userId = event.cookies.get('userId');
	const userKey = event.cookies.get('userKey');

	if (userId && userKey) {
		event.locals.zuser = { userId, userKey }; 
	}

	return resolve(event);
};

function redirectTo(pathname: string): Response {
	return Response.redirect(pathname, 303);
}

function getAppRootPath(): string {
	return resolvePath('/');
}

const authHandle: Handle = async ({ event, resolve }) => {
	const { request, url, cookies } = event;
	const pathname = url.pathname;
	const method = request.method.toUpperCase();
	const searchEnabled = isSearchEnabled();

	if (isStaticAssetPath(pathname)) {
		return resolve(event);
	}

	if (!searchEnabled && isSearchFeatureApiPath(pathname)) {
		event.locals.logger?.warn(
			{ event: 'search.disabled', pathname, method },
			'Search API is disabled'
		);
		return errorResponse('Search is disabled', 404);
	}

	if (pathname.startsWith('/api/') && isPublicApiRoute(pathname, method)) {
		return resolve(event);
	}

	const sessionToken = cookies.get(SAKE_SESSION_COOKIE_NAME);
	const apiKeyHeader = request.headers.get(SAKE_API_KEY_HEADER_NAME);
	const apiKey = apiKeyHeader?.trim() ? apiKeyHeader.trim() : null;

	if (!sessionToken && !apiKey) {
		if (pathname.startsWith('/api/')) {
			event.locals.logger?.warn({ event: 'auth.denied', pathname, method }, 'Authentication required');
			return errorResponse('Authentication required', 401);
		}

		if (pathname.startsWith('/remote/')) {
			return errorResponse('Authentication required', 401);
		}

		if (pathname === '/') {
			return resolve(event);
		}

			return redirectTo(getAppRootPath());
	}

	try {
		const auth = await resolveRequestAuthUseCase.execute({
			sessionToken: sessionToken ?? null,
			apiKey
		});
		event.locals.auth = auth ?? undefined;
	} catch (err: unknown) {
		event.locals.logger?.error({ event: 'auth.resolve.failed', error: toLogError(err) }, 'Auth resolution failed');
		return errorResponse('Authentication error', 500);
	}

	const hasStaleSessionCookie = Boolean(sessionToken) && !apiKey && !event.locals.auth;
	if (hasStaleSessionCookie) {
		clearSakeSessionCookie(cookies, url);
		event.locals.logger?.info(
			{ event: 'auth.session_cookie.cleared', pathname, method },
			'Cleared stale session cookie'
		);

		if (pathname.startsWith('/api/') || pathname.startsWith('/remote/')) {
			return withResponseHeader(
				errorResponse('Authentication required', 401),
				SAKE_CLEAR_SESSION_HEADER_NAME,
				'true'
			);
		}

		if (pathname === '/') {
			return resolve(event);
		}

		return redirectTo(getAppRootPath());
	}

	if (pathname.startsWith('/api/')) {
		if (isPublicApiRoute(pathname, method)) {
			return resolve(event);
		}

		if (!event.locals.auth) {
			event.locals.logger?.warn({ event: 'auth.denied', pathname, method }, 'Authentication required');
			return errorResponse('Authentication required', 401);
		}

		if (event.locals.auth.type === 'api_key' && !isApiKeyAllowedRoute(pathname, method)) {
			event.locals.logger?.warn(
				{
					event: 'auth.api_key.denied',
					pathname,
					method,
					deviceId: event.locals.auth.deviceId
				},
				'API key is not allowed for this route'
			);
			return errorResponse('API key is not allowed for this route', 403);
		}

		try {
			await syncDeviceVersionFromHeader(event);
		} catch (err: unknown) {
			event.locals.logger?.error(
				{ event: 'device.version.header_sync.failed', error: toLogError(err) },
				'Failed to sync device version from request header'
			);
		}

		return resolve(event);
	}

	if (pathname.startsWith('/remote/')) {
		if (event.locals.auth?.type !== 'session') {
			return errorResponse('Authentication required', 401);
		}
		return resolve(event);
	}

	if (pathname === '/') {
		if (event.locals.auth?.type === 'session') {
			return redirectTo(resolvePath(searchEnabled ? '/search' : '/library'));
		}
		return resolve(event);
	}

	if (event.locals.auth?.type !== 'session') {
		return redirectTo(getAppRootPath());
	}

	if (pathname === '/search' || pathname.startsWith('/search/')) {
		if (!searchEnabled) {
			return redirectTo(resolvePath('/library'));
		}
	}

	return resolve(event);
};

export const handle = sequence(requestLogHandle, cookieHandle, authHandle);
