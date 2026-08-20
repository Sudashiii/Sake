import type { AnnotationRepositoryPort } from '$lib/server/application/ports/AnnotationRepositoryPort';
import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import type { AnnotationIndexService } from '$lib/server/application/services/AnnotationIndexService';
import type { SidecarWriteCoordinator } from '$lib/server/application/services/SidecarWriteCoordinator';
import {
	createAnnotationVersion,
	koreaderDateTime,
	koreaderLocalDate,
	mergeKoreaderSidecar,
	parseKoreaderSidecar,
	type ReaderHighlightColor
} from '$lib/koreader/koreaderSidecar';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import type { AnnotationHubItem } from '$lib/types/Annotations/Annotation';
import { createChildLogger, toLogError } from '$lib/server/infrastructure/logging/logger';
import { isDemoMode } from '$lib/server/config/demoMode';

export class AnnotationMutationService {
	private readonly serviceLogger = createChildLogger({ service: 'AnnotationMutationService' });

	constructor(
		private readonly annotationRepository: AnnotationRepositoryPort,
		private readonly bookRepository: BookRepositoryPort,
		private readonly storage: StoragePort,
		private readonly indexService: AnnotationIndexService,
		private readonly sidecarWriteCoordinator: SidecarWriteCoordinator
	) {}

	async update(input: {
		id: number;
		note: string | null;
		color?: ReaderHighlightColor;
		expectedVersion: string;
	}): Promise<ApiResult<AnnotationHubItem>> {
		if (isDemoMode()) return apiError('Annotations cannot be changed in demo mode', 403);
		const indexed = await this.annotationRepository.getById(input.id);
		if (!indexed) return apiError('Annotation not found', 404);
		if (indexed.kind === 'bookmark' && input.color !== undefined) {
			return apiError('Bookmark colors cannot be changed', 400);
		}


		return this.sidecarWriteCoordinator.run(indexed.book.id, async () => {
			const mutation = await this.loadMutationSource(input.id, indexed.book.id, input.expectedVersion);
			if (!mutation.ok) return mutation;
			const now = koreaderDateTime();
			const updated = {
				...mutation.value.annotation,
				note: input.note?.trim() || undefined,
				color: input.color ?? mutation.value.annotation.color,
				datetimeUpdated: now
			};
			const merged = mergeKoreaderSidecar(
				mutation.value.source,
				{
					percentFinished: mutation.value.snapshot.percentFinished,
					upsertedAnnotations: [updated],
					deletedAnnotationIds: []
				},
				koreaderLocalDate()
			);
			const persisted = await this.persistMutation({
				bookId: indexed.book.id,
				progressStorageKey: mutation.value.progressStorageKey,
				previousSource: mutation.value.source,
				nextSource: merged.source
			});
			if (!persisted.ok) return persisted;
			const refreshed = await this.annotationRepository.getById(input.id);
			return refreshed ? apiOk(refreshed) : apiError('Annotation changed during update', 409);
		});
	}

	async delete(input: {
		id: number;
		expectedVersion: string;
	}): Promise<ApiResult<{ success: true }>> {
		if (isDemoMode()) return apiError('Annotations cannot be changed in demo mode', 403);
		const indexed = await this.annotationRepository.getById(input.id);
		if (!indexed) return apiError('Annotation not found', 404);
		return this.sidecarWriteCoordinator.run(indexed.book.id, async () => {
			const mutation = await this.loadMutationSource(input.id, indexed.book.id, input.expectedVersion);
			if (!mutation.ok) return mutation;
			const merged = mergeKoreaderSidecar(
				mutation.value.source,
				{
					percentFinished: mutation.value.snapshot.percentFinished,
					upsertedAnnotations: [],
					deletedAnnotationIds: [mutation.value.annotation.id]
				},
				koreaderLocalDate()
			);
			const persisted = await this.persistMutation({
				bookId: indexed.book.id,
				progressStorageKey: mutation.value.progressStorageKey,
				previousSource: mutation.value.source,
				nextSource: merged.source
			});
			return persisted.ok ? apiOk({ success: true }) : persisted;
		});
	}

	private async loadMutationSource(id: number, bookId: number, expectedVersion: string) {
		const book = await this.bookRepository.getById(bookId);
		if (!book?.progress_storage_key) return apiError('Annotation sidecar not found', 409);
		const sourceId = await this.annotationRepository.getSourceId(id);
		if (!sourceId) return apiError('Annotation not found', 404);
		let source: string;
		try {
			source = (await this.storage.get(`library/${book.progress_storage_key}`)).toString('utf8');
		} catch (cause: unknown) {
			return apiError('Annotation sidecar not found', 409, cause);
		}
		let snapshot;
		try {
			snapshot = parseKoreaderSidecar(source);
		} catch (cause: unknown) {
			return apiError('Annotation sidecar cannot be edited safely', 409, cause);
		}
		const annotation = snapshot.annotations.find((candidate) => candidate.id === sourceId);
		if (!annotation) return apiError('Annotation changed on another device; refresh and try again', 409);
		if (createAnnotationVersion(annotation) !== expectedVersion) {
			return apiError('Annotation changed on another device; refresh and try again', 409);
		}
		return apiOk({ annotation, snapshot, source, progressStorageKey: book.progress_storage_key });
	}

	private async persistMutation(input: {
		bookId: number;
		progressStorageKey: string;
		previousSource: string;
		nextSource: string;
	}): Promise<ApiResult<{ success: true }>> {
		const storageKey = `library/${input.progressStorageKey}`;
		const progressUpdatedAt = new Date().toISOString();
		try {
			await this.storage.put(storageKey, Buffer.from(input.nextSource), 'application/x-lua');
			await this.bookRepository.touchProgressUpdatedAt(input.bookId, progressUpdatedAt);
			await this.indexService.indexSource({
				bookId: input.bookId,
				source: input.nextSource,
				progressUpdatedAt
			});
			return apiOk({ success: true });
		} catch (cause: unknown) {
			try {
				await this.storage.put(storageKey, Buffer.from(input.previousSource), 'application/x-lua');
				await this.indexService.tryIndexSource({
					bookId: input.bookId,
					source: input.previousSource,
					progressUpdatedAt
				});
			} catch (restoreError: unknown) {
				this.serviceLogger.error(
					{ event: 'annotation.mutation.compensation_failed', bookId: input.bookId, error: toLogError(restoreError) },
					'Failed to restore sidecar after annotation mutation failure'
				);
			}
			return apiError('Failed to save annotation', 500, cause);
		}
	}
}
