import { AnnotationExportService } from '$lib/server/application/services/AnnotationExportService';
import { AnnotationMutationService } from '$lib/server/application/services/AnnotationMutationService';
import { DeleteAnnotationUseCase } from '$lib/server/application/use-cases/DeleteAnnotationUseCase';
import { GetAnnotationFacetsUseCase } from '$lib/server/application/use-cases/GetAnnotationFacetsUseCase';
import { GetAnnotationUseCase } from '$lib/server/application/use-cases/GetAnnotationUseCase';
import { ListAnnotationsUseCase } from '$lib/server/application/use-cases/ListAnnotationsUseCase';
import { ReindexAnnotationsUseCase } from '$lib/server/application/use-cases/ReindexAnnotationsUseCase';
import { UpdateAnnotationUseCase } from '$lib/server/application/use-cases/UpdateAnnotationUseCase';
import {
	annotationIndexService,
	annotationRepository,
	bookRepository,
	sidecarWriteCoordinator,
	storage
} from './foundation';

export const annotationMutationService = new AnnotationMutationService(
	annotationRepository,
	bookRepository,
	storage,
	annotationIndexService,
	sidecarWriteCoordinator
);
export const listAnnotationsUseCase = new ListAnnotationsUseCase(
	annotationRepository,
	annotationIndexService
);
export const getAnnotationFacetsUseCase = new GetAnnotationFacetsUseCase(annotationRepository);
export const getAnnotationUseCase = new GetAnnotationUseCase(annotationRepository);
export const updateAnnotationUseCase = new UpdateAnnotationUseCase(annotationMutationService);
export const deleteAnnotationUseCase = new DeleteAnnotationUseCase(annotationMutationService);
export const reindexAnnotationsUseCase = new ReindexAnnotationsUseCase(annotationIndexService);
export const annotationExportService = new AnnotationExportService(annotationRepository);
