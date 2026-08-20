import { HIGHLIGHT_COLORS } from '$lib/koreader/koreaderSidecar';
import {
	EMPTY_ANNOTATION_QUERY,
	type AnnotationFilterType,
	type AnnotationQuery,
	type AnnotationSort
} from '$lib/types/Annotations/Annotation';

const FILTER_TYPES = new Set<AnnotationFilterType>(['all', 'highlight', 'bookmark', 'with-note']);
const SORTS = new Set<AnnotationSort>(['newest', 'oldest', 'book']);
const COLORS = new Set<string>(HIGHLIGHT_COLORS);

function positiveInteger(value: string | null, label: string): number | null {
	if (value === null || value === '') return null;
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`);
	return parsed;
}

function dateOnly(value: string | null, label: string): string | null {
	if (!value) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
		throw new Error(`${label} must use YYYY-MM-DD`);
	}
	return value;
}

export function parseAnnotationQuery(params: URLSearchParams): AnnotationQuery {
	const q = params.get('q')?.trim() || null;
	if (q && q.length > 200) throw new Error('q must be at most 200 characters');
	const typeValue = params.get('type') || EMPTY_ANNOTATION_QUERY.type;
	if (!FILTER_TYPES.has(typeValue as AnnotationFilterType)) throw new Error('Invalid annotation type');
	const sortValue = params.get('sort') || EMPTY_ANNOTATION_QUERY.sort;
	if (!SORTS.has(sortValue as AnnotationSort)) throw new Error('Invalid annotation sort');
	const color = params.get('color')?.trim() || null;
	if (color && !COLORS.has(color)) throw new Error('Invalid annotation color');
	const limitRaw = params.get('limit');
	const limit = limitRaw === null ? EMPTY_ANNOTATION_QUERY.limit : Number(limitRaw);
	if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
		throw new Error('limit must be an integer between 1 and 100');
	}
	const from = dateOnly(params.get('from'), 'from');
	const to = dateOnly(params.get('to'), 'to');
	if (from && to && from > to) throw new Error('from must not be after to');
	return {
		q,
		type: typeValue as AnnotationFilterType,
		bookId: positiveInteger(params.get('bookId'), 'bookId'),
		shelfId: positiveInteger(params.get('shelfId'), 'shelfId'),
		color,
		from,
		to,
		sort: sortValue as AnnotationSort,
		cursor: params.get('cursor')?.trim() || null,
		limit
	};
}
