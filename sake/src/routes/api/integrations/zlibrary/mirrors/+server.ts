import {
	getZLibraryMirrorSettingsUseCase,
	updateZLibraryMirrorSettingsUseCase
} from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { json, type RequestHandler } from '@sveltejs/kit';

function requireSession(locals: App.Locals): Response | null {
	return locals.auth?.type === 'session' ? null : errorResponse('Authentication required', 401);
}

export const GET: RequestHandler = async ({ locals }) => {
	const denied = requireSession(locals);
	if (denied) return denied;

	const result = await getZLibraryMirrorSettingsUseCase.execute();
	return result.ok ? json(result.value) : errorResponse(result.error.message, result.error.status);
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	const denied = requireSession(locals);
	if (denied) return denied;

	try {
		const result = await updateZLibraryMirrorSettingsUseCase.execute(await request.json());
		return result.ok ? json(result.value) : errorResponse(result.error.message, result.error.status);
	} catch {
		return errorResponse('Request body must be valid JSON', 400);
	}
};
