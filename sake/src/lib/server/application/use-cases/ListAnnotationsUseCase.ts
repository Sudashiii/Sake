import type {
	AnnotationCursor,
	AnnotationRepositoryPort
} from '$lib/server/application/ports/AnnotationRepositoryPort';
import type { AnnotationIndexService } from '$lib/server/application/services/AnnotationIndexService';
import type { AnnotationListResponse, AnnotationQuery } from '$lib/types/Annotations/Annotation';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

function encodeCursor(cursor: AnnotationCursor): string {
	return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string | null): AnnotationCursor | null {
	if (!value) return null;
	try {
		const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
		if (
			typeof parsed === 'object' &&
			parsed !== null &&
			typeof (parsed as { primary?: unknown }).primary === 'string' &&
			Number.isInteger((parsed as { id?: unknown }).id) &&
			Number((parsed as { id: number }).id) > 0
		) {
			return parsed as AnnotationCursor;
		}
	} catch {
		// Handled below as a boundary validation error.
	}
	throw new Error('Invalid annotation cursor');
}

export class ListAnnotationsUseCase {
	constructor(
		private readonly repository: AnnotationRepositoryPort,
		private readonly indexService: AnnotationIndexService
	) {}

	async execute(query: AnnotationQuery): Promise<ApiResult<AnnotationListResponse>> {
		let cursor: AnnotationCursor | null;
		try {
			cursor = decodeCursor(query.cursor);
		} catch {
			return apiError('Invalid annotation cursor', 400);
		}
		const page = await this.repository.list(query, cursor);
		const last = page.items.at(-1);
		const nextCursor =
			page.hasMore && last
				? encodeCursor({
						primary:
							query.sort === 'book'
								? `${last.book.title.toLowerCase()}\u001f${last.page}`
								: (last.updatedAt ?? last.recordedAt),
						id: last.id
					})
				: null;
		return apiOk({
			items: page.items,
			total: page.total,
			nextCursor,
			index: await this.indexService.getSummary()
		});
	}
}
