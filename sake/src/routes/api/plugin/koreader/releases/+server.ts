import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { listKoreaderPluginReleasesUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';

export const GET: RequestHandler = async ({ locals, url }) => {
	const requestLogger = getRequestLogger(locals);

	try {
		const result = await listKoreaderPluginReleasesUseCase.execute();
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'plugin.releases.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Fetch KOReader plugin releases rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json({
			latestVersion: result.value.latestVersion,
			releases: result.value.releases.map((release) => ({
				version: release.version,
				fileName: release.fileName,
				sha256: release.sha256,
				updatedAt: release.updatedAt,
				isLatest: release.isLatest,
				downloadUrl: `${url.origin}/api/plugin/koreader/download?version=${encodeURIComponent(release.version)}`
			}))
		});
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'plugin.releases.failed', error: toLogError(err) },
			'Failed to fetch KOReader plugin releases'
		);
		return errorResponse('Failed to fetch plugin releases', 500);
	}
};
