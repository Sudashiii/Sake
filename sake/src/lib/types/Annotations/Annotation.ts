import type { ReaderAnnotationKind, ReaderHighlightColor } from '$lib/koreader/koreaderSidecar';

export type AnnotationFilterType = 'all' | 'highlight' | 'bookmark' | 'with-note';
export type AnnotationSort = 'newest' | 'oldest' | 'book';

export interface AnnotationBookContext {
	id: number;
	title: string;
	author: string | null;
	cover: string | null;
	extension: string | null;
	isArchived: boolean;
}

export interface AnnotationHubItem {
	id: number;
	version: string;
	kind: ReaderAnnotationKind;
	page: string;
	pos0: string | null;
	pos1: string | null;
	text: string | null;
	note: string | null;
	chapter: string | null;
	drawer: string | null;
	color: string | null;
	recordedAt: string;
	updatedAt: string | null;
	book: AnnotationBookContext;
}

export interface AnnotationIndexSummary {
	totalBooks: number;
	indexedBooks: number;
	failedBooks: number;
	pendingBooks: number;
	isReconciling: boolean;
}

export interface AnnotationListResponse {
	items: AnnotationHubItem[];
	total: number;
	nextCursor: string | null;
	index: AnnotationIndexSummary;
}

export interface AnnotationFacetOption {
	id: number | string;
	label: string;
	count: number;
}

export interface AnnotationFacetsResponse {
	books: AnnotationFacetOption[];
	shelves: AnnotationFacetOption[];
	colors: AnnotationFacetOption[];
	types: AnnotationFacetOption[];
}

export interface UpdateAnnotationRequest {
	note: string | null;
	color?: ReaderHighlightColor;
	expectedVersion: string;
}

export interface DeleteAnnotationRequest {
	expectedVersion: string;
}

export interface AnnotationQuery {
	q: string | null;
	type: AnnotationFilterType;
	bookId: number | null;
	shelfId: number | null;
	color: string | null;
	from: string | null;
	to: string | null;
	sort: AnnotationSort;
	cursor: string | null;
	limit: number;
}

export const EMPTY_ANNOTATION_QUERY: AnnotationQuery = {
	q: null,
	type: 'all',
	bookId: null,
	shelfId: null,
	color: null,
	from: null,
	to: null,
	sort: 'newest',
	cursor: null,
	limit: 50
};
