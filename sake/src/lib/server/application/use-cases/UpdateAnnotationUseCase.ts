import type { AnnotationMutationService } from '$lib/server/application/services/AnnotationMutationService';
import type { UpdateAnnotationRequest } from '$lib/types/Annotations/Annotation';

export class UpdateAnnotationUseCase {
	constructor(private readonly mutationService: AnnotationMutationService) {}

	execute(id: number, request: UpdateAnnotationRequest) {
		return this.mutationService.update({ id, ...request });
	}
}
