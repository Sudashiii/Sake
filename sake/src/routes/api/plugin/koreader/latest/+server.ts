import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getLatestKoreaderPluginUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';

export const GET: RequestHandler = async ({ locals, url }) => {
	const requestLogger = getRequestLogger(locals);
	try {
		const result = await getLatestKoreaderPluginUseCase.execute();
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'plugin.latest.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Fetch KOReader plugin metadata rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json({
			version: result.value.version,
			fileName: result.value.fileName,
			sha256: result.value.sha256,
			updatedAt: result.value.updatedAt,
			downloadUrl: `${url.origin}/api/plugin/koreader/download`
		});
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'plugin.latest.failed', error: toLogError(err) },
			'Failed to fetch KOReader plugin metadata'
		);
		return errorResponse('Failed to fetch plugin metadata', 500);
	}
};
