import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	deleteAnnotationUseCase,
	getAnnotationUseCase,
	updateAnnotationUseCase
} from '$lib/server/application/composition';
import { HIGHLIGHT_COLORS, type ReaderHighlightColor } from '$lib/koreader/koreaderSidecar';
import { errorResponse } from '$lib/server/http/api';

function annotationId(raw: string): number | null {
	const id = Number(raw);
	return Number.isInteger(id) && id > 0 ? id : null;
}

export const GET: RequestHandler = async ({ params }) => {
	const id = annotationId(params.id);
	if (!id) return errorResponse('Invalid annotation id', 400);
	const result = await getAnnotationUseCase.execute(id);
	return result.ok ? json(result.value) : errorResponse(result.error.message, result.error.status);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = annotationId(params.id);
	if (!id) return errorResponse('Invalid annotation id', 400);
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return errorResponse('Invalid JSON body', 400);
	}
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		return errorResponse('Invalid annotation update', 400);
	}
	const value = body as { note?: unknown; color?: unknown; expectedVersion?: unknown };
	if (value.note !== null && typeof value.note !== 'string') return errorResponse('note must be a string or null', 400);
	if (typeof value.note === 'string' && value.note.length > 20_000) return errorResponse('note must be at most 20000 characters', 400);
	if (typeof value.expectedVersion !== 'string' || value.expectedVersion.length === 0) {
		return errorResponse('expectedVersion is required', 400);
	}
	if (value.color !== undefined && !HIGHLIGHT_COLORS.includes(value.color as ReaderHighlightColor)) {
		return errorResponse('Invalid annotation color', 400);
	}
	const result = await updateAnnotationUseCase.execute(id, {
		note: (value.note as string | null | undefined) ?? null,
		...(value.color === undefined ? {} : { color: value.color as ReaderHighlightColor }),
		expectedVersion: value.expectedVersion
	});
	return result.ok ? json(result.value) : errorResponse(result.error.message, result.error.status);
};

export const DELETE: RequestHandler = async ({ params, request }) => {
	const id = annotationId(params.id);
	if (!id) return errorResponse('Invalid annotation id', 400);
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return errorResponse('Invalid JSON body', 400);
	}
	const expectedVersion =
		typeof body === 'object' && body !== null && !Array.isArray(body)
			? (body as { expectedVersion?: unknown }).expectedVersion
			: null;
	if (typeof expectedVersion !== 'string' || expectedVersion.length === 0) {
		return errorResponse('expectedVersion is required', 400);
	}
	const result = await deleteAnnotationUseCase.execute(id, expectedVersion);
	return result.ok ? json(result.value) : errorResponse(result.error.message, result.error.status);
};
