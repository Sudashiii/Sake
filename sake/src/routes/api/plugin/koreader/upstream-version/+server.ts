import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getKoreaderPluginUpstreamVersionUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';

export const GET: RequestHandler = async ({ locals }) => {
	const requestLogger = getRequestLogger(locals);

	try {
		const result = await getKoreaderPluginUpstreamVersionUseCase.execute();
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'plugin.upstream_version.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Fetch upstream KOReader plugin version rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'plugin.upstream_version.failed', error: toLogError(err) },
			'Failed to fetch upstream KOReader plugin version'
		);
		return errorResponse('Failed to fetch upstream plugin version', 500);
	}
};
