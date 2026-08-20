import type { AnnotationIndexService } from '$lib/server/application/services/AnnotationIndexService';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import { isDemoMode } from '$lib/server/config/demoMode';

export class ReindexAnnotationsUseCase {
	constructor(private readonly indexService: AnnotationIndexService) {}

	async execute(bookId?: number): Promise<ApiResult<{ accepted: true }>> {
		if (isDemoMode()) return apiError('Annotation indexing is unavailable in demo mode', 403);
		this.indexService.startReconciliation(bookId);
		return apiOk({ accepted: true });
	}
}
