import { downloadSearchBookUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { SEARCH_PROVIDER_IDS, type SearchProviderId } from '$lib/types/Search/Provider';
import type { RequestHandler } from '@sveltejs/kit';

interface DownloadSearchBody {
	provider: SearchProviderId;
	downloadRef: string;
	title: string;
	extension?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProviderId(value: string): value is SearchProviderId {
	return (SEARCH_PROVIDER_IDS as readonly string[]).includes(value);
}

function parseBody(raw: unknown): DownloadSearchBody {
	if (!isRecord(raw)) {
		throw new Error('Body must be a JSON object');
	}

	if (typeof raw.provider !== 'string' || !isProviderId(raw.provider)) {
		throw new Error('provider is invalid');
	}
	if (typeof raw.downloadRef !== 'string' || raw.downloadRef.trim().length === 0) {
		throw new Error('downloadRef is required');
	}
	if (typeof raw.title !== 'string' || raw.title.trim().length === 0) {
		throw new Error('title is required');
	}
	if (
		raw.extension !== undefined &&
		raw.extension !== null &&
		typeof raw.extension !== 'string'
	) {
		throw new Error('extension must be a string or null');
	}

	return {
		provider: raw.provider,
		downloadRef: raw.downloadRef,
		title: raw.title,
		extension: raw.extension as string | null | undefined
	};
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const requestLogger = getRequestLogger(locals);

	let body: DownloadSearchBody;
	try {
		const raw = await request.json();
		body = parseBody(raw);
	} catch (err: unknown) {
		requestLogger.warn(
			{ event: 'search.download.invalid_payload', error: toLogError(err) },
			'Search download payload validation failed'
		);
		return errorResponse(err instanceof Error ? err.message : 'Invalid JSON body', 400);
	}

	try {
		const result = await downloadSearchBookUseCase.execute(body);
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'search.download.use_case_failed',
					provider: body.provider,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Search download rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		const { fileData, fileName, contentType } = result.value;
		const responseBody = new Uint8Array(fileData);
		return new Response(responseBody, {
			status: 200,
			headers: {
				'content-type': contentType,
				'content-length': String(fileData.byteLength),
				'content-disposition': `attachment; filename="${fileName}"`
			}
		});
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'search.download.failed', provider: body.provider, error: toLogError(err) },
			'Search download failed'
		);
		return errorResponse('Search download failed', 500);
	}
};
