import { createShelfUseCase, listShelvesUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const requestLogger = getRequestLogger(locals);
	try {
		const result = await listShelvesUseCase.execute();
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'library.shelves.list.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message
				},
				'List shelves rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}
		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'library.shelves.list.failed', error: toLogError(err) },
			'Failed to list shelves'
		);
		return errorResponse('Failed to list shelves', 500);
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const requestLogger = getRequestLogger(locals);
	let body: unknown;
	try {
		body = await request.json();
	} catch (err: unknown) {
		requestLogger.warn(
			{ event: 'library.shelves.create.invalid_json', error: toLogError(err) },
			'Invalid JSON body'
		);
		return errorResponse('Invalid JSON body', 400);
	}

	const name = (body as { name?: unknown }).name;
	const icon = (body as { icon?: unknown }).icon;
	if (typeof name !== 'string') {
		return errorResponse('name is required', 400);
	}
	if (icon !== undefined && typeof icon !== 'string') {
		return errorResponse('icon must be a string', 400);
	}

	try {
		const result = await createShelfUseCase.execute({
			name,
			icon: typeof icon === 'string' ? icon : undefined
		});
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'library.shelves.create.use_case_failed',
					statusCode: result.error.status,
					reason: result.error.message,
					name
				},
				'Create shelf rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json(result.value, { status: 201 });
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'library.shelves.create.failed', error: toLogError(err), name },
			'Failed to create shelf'
		);
		return errorResponse('Failed to create shelf', 500);
	}
};
