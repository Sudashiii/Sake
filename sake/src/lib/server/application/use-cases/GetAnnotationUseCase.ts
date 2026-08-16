import type { AnnotationRepositoryPort } from '$lib/server/application/ports/AnnotationRepositoryPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import type { AnnotationHubItem } from '$lib/types/Annotations/Annotation';

export class GetAnnotationUseCase {
	constructor(private readonly repository: AnnotationRepositoryPort) {}

	async execute(id: number): Promise<ApiResult<AnnotationHubItem>> {
		const annotation = await this.repository.getById(id);
		return annotation ? apiOk(annotation) : apiError('Annotation not found', 404);
	}
}
