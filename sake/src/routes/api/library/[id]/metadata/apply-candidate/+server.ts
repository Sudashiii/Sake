import { applyMetadataCandidateUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { parseApplyMetadataCandidateBody } from '$lib/server/http/applyMetadataCandidate';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const requestLogger = getRequestLogger(locals);
	const id = Number(params.id);
	if (!Number.isFinite(id)) {
		return errorResponse('Invalid book id', 400);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch (err: unknown) {
		requestLogger.warn(
			{ event: 'library.metadata.apply_candidate.invalid_json', error: toLogError(err), bookId: id },
			'Invalid JSON body'
		);
		return errorResponse('Invalid JSON body', 400);
	}

	let parsedBody: ReturnType<typeof parseApplyMetadataCandidateBody>;
	try {
		parsedBody = parseApplyMetadataCandidateBody(body);
	} catch (err: unknown) {
		requestLogger.warn(
			{
				event: 'library.metadata.apply_candidate.validation_failed',
				error: toLogError(err),
				bookId: id
			},
			'Metadata candidate apply validation failed'
		);
		return errorResponse(
			err instanceof Error ? err.message : 'Invalid metadata candidate apply payload',
			400
		);
	}

	try {
		const result = await applyMetadataCandidateUseCase.execute({
			bookId: id,
			...parsedBody
		});
		if (!result.ok) {
			requestLogger.warn(
				{
					event: 'library.metadata.apply_candidate.use_case_failed',
					bookId: id,
					statusCode: result.error.status,
					reason: result.error.message
				},
				'Metadata candidate apply rejected'
			);
			return errorResponse(result.error.message, result.error.status);
		}

		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'library.metadata.apply_candidate.failed', error: toLogError(err), bookId: id },
			'Failed to apply metadata candidate'
		);
		return errorResponse('Failed to apply metadata candidate', 500);
	}
};
