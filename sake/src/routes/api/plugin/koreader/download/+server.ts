import type { RequestHandler } from '@sveltejs/kit';
import { getKoreaderPluginDownloadUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';

export const GET: RequestHandler = async ({ locals }) => {
	const requestLogger = getRequestLogger(locals);
	try {
		const result = await getKoreaderPluginDownloadUseCase.execute();
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'plugin.download.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Download KOReader plugin rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return new Response(new Uint8Array(result.value.data), {
			headers: {
				'Content-Type': result.value.contentType,
				'Content-Length': String(result.value.data.length),
				'Cache-Control': 'public, max-age=300',
				'Content-Disposition': `attachment; filename="${result.value.fileName}"`,
				'X-Plugin-Sha256': result.value.sha256
			}
		});
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'plugin.download.failed', error: toLogError(err) },
			'Failed to download KOReader plugin'
		);
		return errorResponse('Failed to download plugin', 500);
	}
};
