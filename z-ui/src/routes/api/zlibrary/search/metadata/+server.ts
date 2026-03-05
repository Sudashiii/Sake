import { lookupSearchBookMetadataUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

interface MetadataLookupBody {
	title: string;
	author?: string | null;
	identifier?: string | null;
	language?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOptionalNullableString(
	body: Record<string, unknown>,
	key: 'author' | 'identifier' | 'language'
): string | null | undefined {
	if (!(key in body)) {
		return undefined;
	}
	const value = body[key];
	if (value === null) {
		return null;
	}
	if (typeof value === 'string') {
		return value;
	}
	throw new Error(`${key} must be a string or null`);
}

function parseBody(raw: unknown): MetadataLookupBody {
	if (!isRecord(raw)) {
		throw new Error('Body must be a JSON object');
	}

	const title = raw.title;
	if (typeof title !== 'string' || title.trim().length === 0) {
		throw new Error('title is required');
	}

	return {
		title,
		author: parseOptionalNullableString(raw, 'author'),
		identifier: parseOptionalNullableString(raw, 'identifier'),
		language: parseOptionalNullableString(raw, 'language')
	};
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const requestLogger = getRequestLogger(locals);

	let parsedBody: MetadataLookupBody;
	try {
		const raw = await request.json();
		parsedBody = parseBody(raw);
	} catch (err: unknown) {
		requestLogger.warn(
			{ event: 'zlibrary.search.metadata.invalid_payload', error: toLogError(err) },
			'Search metadata payload validation failed'
		);
		return errorResponse(err instanceof Error ? err.message : 'Invalid JSON body', 400);
	}

	try {
		const result = await lookupSearchBookMetadataUseCase.execute(parsedBody);
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'zlibrary.search.metadata.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Search metadata lookup rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'zlibrary.search.metadata.failed', error: toLogError(err) },
			'Search metadata lookup failed'
		);
		return errorResponse('Failed to lookup external metadata', 500);
	}
};
