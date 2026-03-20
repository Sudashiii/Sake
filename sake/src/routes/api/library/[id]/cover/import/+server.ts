import { importLibraryBookCoverUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function parseCoverUrl(body: unknown): string | null | undefined {
	if (body === null || body === undefined) {
		return undefined;
	}

	if (typeof body !== 'object' || Array.isArray(body)) {
		throw new Error('Body must be a JSON object');
	}

	const raw = (body as Record<string, unknown>).coverUrl;
	if (raw === undefined) {
		return undefined;
	}
	if (raw === null) {
		return null;
	}
	if (typeof raw === 'string') {
		return raw;
	}
	throw new Error('coverUrl must be a string or null');
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const requestLogger = getRequestLogger(locals);
	const id = Number(params.id);
	if (!Number.isFinite(id)) {
		return errorResponse('Invalid book id', 400);
	}

	let coverUrl: string | null | undefined;
	try {
		coverUrl = parseCoverUrl(await request.json());
	} catch (err: unknown) {
		requestLogger.warn(
			{ event: 'library.cover.import.validation_failed', error: toLogError(err), bookId: id },
			'Cover import validation failed'
		);
		return errorResponse(err instanceof Error ? err.message : 'Invalid cover import payload', 400);
	}

	try {
		const result = await importLibraryBookCoverUseCase.execute({
			bookId: id,
			coverUrl
		});
		if (!result.ok) {
			return errorResponse(result.error.message, result.error.status);
		}
		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'library.cover.import.failed', error: toLogError(err), bookId: id },
			'Failed to import library cover'
		);
		return errorResponse('Failed to import library cover', 500);
	}
};
