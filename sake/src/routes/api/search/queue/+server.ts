import { queueSearchBookUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import type {
	QueueSearchBookRequest,
	QueueableSearchProviderId
} from '$lib/types/Search/QueueSearchBookRequest';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isQueueableProvider(value: string): value is QueueableSearchProviderId {
	return value === 'anna' || value === 'openlibrary' || value === 'gutenberg';
}

function parseBody(raw: unknown): QueueSearchBookRequest {
	if (!isRecord(raw)) {
		throw new Error('Body must be a JSON object');
	}

	if (typeof raw.provider !== 'string' || !isQueueableProvider(raw.provider)) {
		throw new Error('provider is invalid');
	}
	if (typeof raw.providerBookId !== 'string' || raw.providerBookId.trim().length === 0) {
		throw new Error('providerBookId is required');
	}
	if (typeof raw.downloadRef !== 'string' || raw.downloadRef.trim().length === 0) {
		throw new Error('downloadRef is required');
	}
	if (typeof raw.title !== 'string' || raw.title.trim().length === 0) {
		throw new Error('title is required');
	}

	const optionalStringKeys = [
		'extension',
		'author',
		'series',
		'volume',
		'identifier',
		'description',
		'cover',
		'language'
	] as const;
	for (const key of optionalStringKeys) {
		const value = raw[key];
		if (value !== undefined && value !== null && typeof value !== 'string') {
			throw new Error(`${key} must be a string or null`);
		}
	}

	for (const key of ['pages', 'filesize', 'year', 'seriesIndex'] as const) {
		const value = raw[key];
		if (
			value !== undefined &&
			value !== null &&
			(typeof value !== 'number' || !Number.isFinite(value))
		) {
			throw new Error(`${key} must be a number or null`);
		}
	}

	if (typeof raw.seriesIndex === 'number' && raw.seriesIndex < 0) {
		throw new Error('seriesIndex must be a non-negative number or null');
	}

	return {
		provider: raw.provider,
		providerBookId: raw.providerBookId.trim(),
		downloadRef: raw.downloadRef.trim(),
		title: raw.title.trim(),
		extension: (raw.extension as string | null | undefined) ?? null,
		author: (raw.author as string | null | undefined) ?? null,
		series: (raw.series as string | null | undefined) ?? null,
		volume: (raw.volume as string | null | undefined) ?? null,
		seriesIndex: (raw.seriesIndex as number | null | undefined) ?? null,
		identifier: (raw.identifier as string | null | undefined) ?? null,
		pages: (raw.pages as number | null | undefined) ?? null,
		description: (raw.description as string | null | undefined) ?? null,
		cover: (raw.cover as string | null | undefined) ?? null,
		filesize: (raw.filesize as number | null | undefined) ?? null,
		language: (raw.language as string | null | undefined) ?? null,
		year: (raw.year as number | null | undefined) ?? null
	};
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const requestLogger = getRequestLogger(locals);

	if (!locals.auth) {
		requestLogger.warn({ event: 'search.queue.auth_missing' }, 'Authentication required for search queue');
		return errorResponse('Authentication required', 401);
	}

	let body: QueueSearchBookRequest;
	try {
		const raw = await request.json();
		body = parseBody(raw);
	} catch (err: unknown) {
		requestLogger.warn(
			{ event: 'search.queue.invalid_payload', error: toLogError(err) },
			'Search queue payload validation failed'
		);
		return errorResponse(err instanceof Error ? err.message : 'Invalid JSON body', 400);
	}

	try {
		const result = await queueSearchBookUseCase.execute({
			request: body,
			userId: String(locals.auth.user.id)
		});
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'search.queue.use_case_failed',
					provider: body.provider,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Search queue rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'search.queue.failed', provider: body.provider, error: toLogError(err) },
			'Search queue failed'
		);
		return errorResponse('Search queue failed', 500);
	}
};
