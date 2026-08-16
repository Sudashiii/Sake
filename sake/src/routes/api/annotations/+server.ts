import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { listAnnotationsUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { parseAnnotationQuery } from '$lib/server/http/annotationQuery';

export const GET: RequestHandler = async ({ url }) => {
	let query;
	try {
		query = parseAnnotationQuery(url.searchParams);
	} catch (error: unknown) {
		return errorResponse(error instanceof Error ? error.message : 'Invalid annotation query', 400);
	}
	const result = await listAnnotationsUseCase.execute(query);
	return result.ok ? json(result.value) : errorResponse(result.error.message, result.error.status);
};
