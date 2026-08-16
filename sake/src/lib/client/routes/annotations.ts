import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type {
	AnnotationFacetsResponse,
	AnnotationHubItem,
	AnnotationListResponse,
	AnnotationQuery,
	DeleteAnnotationRequest,
	UpdateAnnotationRequest
} from '$lib/types/Annotations/Annotation';
import { err, ok, type Result } from '$lib/types/Result';

export function annotationQueryParams(query: AnnotationQuery, includeCursor = true): URLSearchParams {
	const params = new URLSearchParams();
	if (query.q) params.set('q', query.q);
	if (query.type !== 'all') params.set('type', query.type);
	if (query.bookId !== null) params.set('bookId', String(query.bookId));
	if (query.shelfId !== null) params.set('shelfId', String(query.shelfId));
	if (query.color) params.set('color', query.color);
	if (query.from) params.set('from', query.from);
	if (query.to) params.set('to', query.to);
	if (query.sort !== 'newest') params.set('sort', query.sort);
	if (includeCursor && query.cursor) params.set('cursor', query.cursor);
	params.set('limit', String(query.limit));
	return params;
}

async function parseResponse<T>(response: Response, fallback: string): Promise<Result<T, ApiError>> {
	if (!response.ok) return err(await ApiErrors.fromResponse(response));
	try {
		return ok((await response.json()) as T);
	} catch {
		return err(ApiErrors.server(fallback, 500));
	}
}

export async function getAnnotations(
	query: AnnotationQuery
): Promise<Result<AnnotationListResponse, ApiError>> {
	try {
		return parseResponse(
			await fetch(`/api/annotations?${annotationQueryParams(query).toString()}`),
			'Failed to parse annotations response'
		);
	} catch (cause: unknown) {
		return err(ApiErrors.network('Failed to load annotations', cause));
	}
}

export async function getAnnotationFacets(): Promise<Result<AnnotationFacetsResponse, ApiError>> {
	try {
		return parseResponse(await fetch('/api/annotations/facets'), 'Failed to parse annotation filters');
	} catch (cause: unknown) {
		return err(ApiErrors.network('Failed to load annotation filters', cause));
	}
}

export async function getAnnotation(id: number): Promise<Result<AnnotationHubItem, ApiError>> {
	try {
		return parseResponse(await fetch(`/api/annotations/${id}`), 'Failed to parse annotation');
	} catch (cause: unknown) {
		return err(ApiErrors.network('Failed to load annotation', cause));
	}
}

export async function updateAnnotation(
	id: number,
	request: UpdateAnnotationRequest
): Promise<Result<AnnotationHubItem, ApiError>> {
	try {
		return parseResponse(
			await fetch(`/api/annotations/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(request)
			}),
			'Failed to parse updated annotation'
		);
	} catch (cause: unknown) {
		return err(ApiErrors.network('Failed to update annotation', cause));
	}
}

export async function deleteAnnotation(
	id: number,
	request: DeleteAnnotationRequest
): Promise<Result<void, ApiError>> {
	try {
		const response = await fetch(`/api/annotations/${id}`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(request)
		});
		return response.ok ? ok(undefined) : err(await ApiErrors.fromResponse(response));
	} catch (cause: unknown) {
		return err(ApiErrors.network('Failed to delete annotation', cause));
	}
}

export async function reindexAnnotations(bookId?: number): Promise<Result<void, ApiError>> {
	try {
		const response = await fetch('/api/annotations/reindex', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(bookId === undefined ? {} : { bookId })
		});
		return response.ok ? ok(undefined) : err(await ApiErrors.fromResponse(response));
	} catch (cause: unknown) {
		return err(ApiErrors.network('Failed to start annotation indexing', cause));
	}
}

export function annotationExportUrl(
	query: AnnotationQuery,
	format: 'markdown' | 'json'
): string {
	const params = annotationQueryParams({ ...query, cursor: null }, false);
	params.set('format', format);
	return `/api/annotations/export?${params.toString()}`;
}
