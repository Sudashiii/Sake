import type {
	AnnotationFacetsResponse,
	AnnotationHubItem,
	AnnotationIndexSummary,
	AnnotationQuery
} from '$lib/types/Annotations/Annotation';
import type { ReaderAnnotation } from '$lib/koreader/koreaderSidecar';

export interface AnnotationCursor {
	primary: string;
	id: number;
}

export interface AnnotationPage {
	items: AnnotationHubItem[];
	total: number;
	hasMore: boolean;
}

export interface AnnotationIndexCandidate {
	bookId: number;
	storageKey: string;
	progressStorageKey: string;
	progressUpdatedAt: string | null;
}

export interface AnnotationRepositoryPort {
	replaceForBook(input: {
		bookId: number;
		annotations: ReaderAnnotation[];
		sourceProgressUpdatedAt: string | null;
		parserVersion: number;
	}): Promise<void>;
	markFailed(input: {
		bookId: number;
		sourceProgressUpdatedAt: string | null;
		parserVersion: number;
		error: string;
	}): Promise<void>;
	list(query: AnnotationQuery, cursor: AnnotationCursor | null): Promise<AnnotationPage>;
	getById(id: number): Promise<AnnotationHubItem | undefined>;
	getSourceId(id: number): Promise<string | undefined>;
	getFacets(): Promise<AnnotationFacetsResponse>;
	getIndexSummary(parserVersion: number): Promise<AnnotationIndexSummary>;
	listIndexCandidates(parserVersion: number, bookId?: number): Promise<AnnotationIndexCandidate[]>;
	listAllForExport(query: AnnotationQuery): AsyncIterable<AnnotationHubItem>;
}
