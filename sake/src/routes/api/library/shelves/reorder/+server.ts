import { reorderShelvesUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function parseShelfIds(raw: unknown): number[] | null {
	if (!Array.isArray(raw)) {
		return null;
	}

	const parsed: number[] = [];
	for (const value of raw) {
		if (!Number.isInteger(value) || value <= 0) {
			return null;
		}
		parsed.push(value);
	}
	return parsed;
}

export const PATCH: RequestHandler = async ({ request, locals }) => {
	const requestLogger = getRequestLogger(locals);

	let body: unknown;
	try {
		body = await request.json();
	} catch (err: unknown) {
		requestLogger.warn(
			{ event: 'library.shelves.reorder.invalid_json', error: toLogError(err) },
			'Invalid JSON body'
		);
		return errorResponse('Invalid JSON body', 400);
	}

	const shelfIds = parseShelfIds((body as { shelfIds?: unknown }).shelfIds);
	if (!shelfIds) {
		return errorResponse('shelfIds must be an array of positive integer ids', 400);
	}

	try {
		const result = await reorderShelvesUseCase.execute({ shelfIds });
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'library.shelves.reorder.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message,
					shelfIds
				},
				'Reorder shelves rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'library.shelves.reorder.failed', error: toLogError(err), shelfIds },
			'Failed to reorder shelves'
		);
		return errorResponse('Failed to reorder shelves', 500);
	}
};
