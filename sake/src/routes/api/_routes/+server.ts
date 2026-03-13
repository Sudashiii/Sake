import { getApiRouteCatalog } from '$lib/server/http/routeCatalog';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const requestLogger = getRequestLogger(locals);
	try {
		const routes = await getApiRouteCatalog();
		return json({
			success: true,
			routes
		});
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'api.routes.catalog.failed', error: toLogError(err) },
			'Failed to generate API route catalog'
		);
		return errorResponse('Failed to generate API route catalog', 500);
	}
};
