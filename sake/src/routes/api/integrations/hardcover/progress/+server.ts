import {
	getHardcoverProgressSyncStatusUseCase,
	updateHardcoverProgressSyncSettingUseCase
} from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function requireSession(locals: App.Locals): Response | null {
	return locals.auth?.type === 'session' ? null : errorResponse('Authentication required', 401);
}

export const GET: RequestHandler = async ({ locals }) => {
	const denied = requireSession(locals);
	if (denied) return denied;
	try {
		const result = await getHardcoverProgressSyncStatusUseCase.execute();
		return result.ok ? json(result.value) : errorResponse(result.error.message, result.error.status);
	} catch (err: unknown) {
		getRequestLogger(locals).error({ event: 'hardcover.progress.status.failed', error: toLogError(err) }, 'Failed to fetch Hardcover progress status');
		return errorResponse('Failed to fetch Hardcover progress status', 500);
	}
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	const denied = requireSession(locals);
	if (denied) return denied;
	let body: { enabled?: unknown };
	try {
		body = (await request.json()) as { enabled?: unknown };
	} catch {
		return errorResponse('Invalid JSON body', 400);
	}
	if (typeof body.enabled !== 'boolean') return errorResponse('enabled must be a boolean', 400);
	try {
		const result = await updateHardcoverProgressSyncSettingUseCase.execute({ enabled: body.enabled });
		return result.ok ? json(result.value) : errorResponse(result.error.message, result.error.status);
	} catch (err: unknown) {
		getRequestLogger(locals).error({ event: 'hardcover.progress.setting.failed', error: toLogError(err) }, 'Failed to update Hardcover progress setting');
		return errorResponse('Failed to update Hardcover progress setting', 500);
	}
};
