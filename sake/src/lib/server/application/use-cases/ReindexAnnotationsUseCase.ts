import type { AnnotationIndexService } from '$lib/server/application/services/AnnotationIndexService';
import { apiOk, type ApiResult } from '$lib/server/http/api';

export class ReindexAnnotationsUseCase {
	constructor(private readonly indexService: AnnotationIndexService) {}

	async execute(bookId?: number): Promise<ApiResult<{ accepted: true }>> {
		this.indexService.startReconciliation(bookId);
		return apiOk({ accepted: true });
	}
}
