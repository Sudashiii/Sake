import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getAnnotationFacetsUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';

export const GET: RequestHandler = async () => {
	const result = await getAnnotationFacetsUseCase.execute();
	return result.ok ? json(result.value) : errorResponse(result.error.message, result.error.status);
};
