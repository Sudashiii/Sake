import { env } from '$env/dynamic/public';
import { createWebappVersion } from '$lib/webappVersion';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const requestLogger = getRequestLogger(locals);

	try {
		return json(
			createWebappVersion({
				version: env.PUBLIC_WEBAPP_VERSION,
				gitTag: env.PUBLIC_WEBAPP_GIT_TAG,
				commitSha: env.PUBLIC_WEBAPP_COMMIT_SHA,
				releasedAt: env.PUBLIC_WEBAPP_RELEASED_AT
			})
		);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'app.version.fetch.failed', error: toLogError(err) },
			'Failed to resolve app version metadata'
		);
		return errorResponse('Failed to resolve app version metadata', 500);
	}
};
