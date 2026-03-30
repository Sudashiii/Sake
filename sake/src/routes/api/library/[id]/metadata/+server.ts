import { updateLibraryBookMetadataUseCase } from '$lib/server/application/composition';
import {
	parseLibraryMetadataUpdateInput,
	type LibraryMetadataUpdateInput
} from '$lib/server/http/libraryMetadataUpdate';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
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
			{ event: 'library.metadata.update.invalid_json', error: toLogError(err), bookId: id },
			'Invalid JSON body'
		);
		return errorResponse('Invalid JSON body', 400);
	}

	let metadata: LibraryMetadataUpdateInput;
	try {
		metadata = parseLibraryMetadataUpdateInput(body);
	} catch (err: unknown) {
		requestLogger.warn(
			{ event: 'library.metadata.update.validation_failed', error: toLogError(err), bookId: id },
			'Metadata update validation failed'
		);
		return errorResponse(err instanceof Error ? err.message : 'Invalid metadata payload', 400);
	}

	try {
		const result = await updateLibraryBookMetadataUseCase.execute({
			bookId: id,
			metadata
		});
		if (!result.ok) {
			return errorResponse(result.error.message, result.error.status);
		}
		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'library.metadata.update.failed', error: toLogError(err), bookId: id },
			'Failed to update metadata'
		);
		return errorResponse('Failed to update metadata', 500);
	}
};
