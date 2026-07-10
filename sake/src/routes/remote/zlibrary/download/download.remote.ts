import { getRequestEvent, command } from '$app/server';
import { downloadBookUseCase } from '$lib/server/application/composition';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import { parseZDownloadBookRequest } from '$lib/server/http/zlibraryDownloadRequest';
import { createChildLogger, toLogError } from '$lib/server/infrastructure/logging/logger';
import type { ZDownloadBookRequest } from '$lib/types/ZLibrary/Requests/ZDownloadBookRequest';

const remoteLogger = createChildLogger({ component: 'remote.zlibrary.download' });

interface RemoteDownloadResult {
	success: true;
	outcome: string;
	fileName?: string;
	fileData?: ArrayBuffer | Uint8Array;
	responseHeaders?: Headers;
	contentType?: string;
}

export const downloadBook = command('unchecked', async (data: ZDownloadBookRequest): Promise<ApiResult<RemoteDownloadResult>> => {
	const { locals } = getRequestEvent();

	let request: ZDownloadBookRequest;
	try {
		request = parseZDownloadBookRequest(data);
	} catch (err: unknown) {
		remoteLogger.warn(
			{ event: 'remote.download.invalid_payload', error: toLogError(err) },
			'Remote download payload validation failed'
		);
		return apiError(err instanceof Error ? err.message : 'Invalid download request', 400);
	}

	if (!locals.zuser) {
		return apiError('Z-Library login is not valid', 400);
	}

	try {
		const result = await downloadBookUseCase.execute({
			request,
			credentials: {
				userId: locals.zuser.userId,
				userKey: locals.zuser.userKey
			}
		});
		if (!result.ok) {
			return result;
		}

		if (request.downloadToDevice === false) {
			return apiOk(result.value);
		}
		if (!result.value.fileData) {
			return apiError('File download failed', 502);
		}

		const safeExtension = request.extension.trim().length > 0 ? request.extension : 'epub';
		return apiOk({
			success: true,
			outcome: result.value.outcome,
			fileName: `${request.title}.${safeExtension}`,
			fileData: new Uint8Array(result.value.fileData),
			contentType: result.value.responseHeaders?.get('content-type') ?? 'application/octet-stream'
		});
	} catch (err: unknown) {
		remoteLogger.error({ event: 'remote.download.failed', error: toLogError(err) }, 'Remote function error');
		return apiError('Download failed', 500, err);
	}
});
