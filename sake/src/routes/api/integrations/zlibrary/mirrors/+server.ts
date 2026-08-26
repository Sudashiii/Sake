import {
	getZLibraryMirrorSettingsUseCase,
	updateZLibraryMirrorSettingsUseCase
} from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json, type RequestHandler } from '@sveltejs/kit';

function requireSession(locals: App.Locals): Response | null {
	return locals.auth?.type === 'session' ? null : errorResponse('Authentication required', 401);
}

export const GET: RequestHandler = async ({ locals }) => {
	const denied = requireSession(locals);
	if (denied) return denied;

	const requestLogger = getRequestLogger(locals);
	try {
		const result = await getZLibraryMirrorSettingsUseCase.execute();
		return result.ok ? json(result.value) : errorResponse(result.error.message, result.error.status);
	} catch (cause) {
		requestLogger.error(
			{ event: 'zlibrary.mirrors.get.failed', error: toLogError(cause) },
			'Failed to load Z-Library mirror settings'
		);
		return errorResponse('Failed to load Z-Library mirror settings', 500);
	}
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	const denied = requireSession(locals);
	if (denied) return denied;

	const requestLogger = getRequestLogger(locals);
	let body: unknown;
	try {
		body = await request.json();
	} catch (cause) {
		requestLogger.warn({ event: 'zlibrary.mirrors.put.invalid_json', error: toLogError(cause) }, 'Invalid JSON body');
		return errorResponse('Request body must be valid JSON', 400);
	}

	try {
		const result = await updateZLibraryMirrorSettingsUseCase.execute(body);
		return result.ok ? json(result.value) : errorResponse(result.error.message, result.error.status);
	} catch (cause) {
		requestLogger.error(
			{ event: 'zlibrary.mirrors.put.failed', error: toLogError(cause) },
			'Failed to update Z-Library mirror settings'
		);
		return errorResponse('Failed to update Z-Library mirror settings', 500);
	}
};
