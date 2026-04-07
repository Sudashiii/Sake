import { uploadLibraryBookCoverUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
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

	try {
		const formData = await request.formData();
		const file = formData.get('file');
		if (!file || typeof (file as File).arrayBuffer !== 'function') {
			requestLogger.warn(
				{ event: 'library.cover.upload.validation_failed', reason: 'file missing', bookId: id },
				'Missing file in cover upload form data'
			);
			return errorResponse('Missing file in form data', 400);
		}

		const uploadedFile = file as File;
		const result = await uploadLibraryBookCoverUseCase.execute({
			bookId: id,
			fileData: await uploadedFile.arrayBuffer(),
			contentType: uploadedFile.type
		});
		if (!result.ok) {
			return errorResponse(result.error.message, result.error.status);
		}
		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'library.cover.upload.failed', error: toLogError(err), bookId: id },
			'Failed to upload library cover'
		);
		return errorResponse('Failed to upload library cover', 500);
	}
};
