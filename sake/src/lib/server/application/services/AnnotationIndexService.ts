import type { AnnotationRepositoryPort } from '$lib/server/application/ports/AnnotationRepositoryPort';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import {
	KOREADER_ANNOTATION_PARSER_VERSION,
	parseKoreaderSidecar
} from '$lib/koreader/koreaderSidecar';
import { createChildLogger, toLogError } from '$lib/server/infrastructure/logging/logger';

const RECONCILE_CONCURRENCY = 4;

function safeError(error: unknown): string {
	return error instanceof Error ? error.message : 'Unsupported KOReader sidecar';
}

export class AnnotationIndexService {
	private reconcilePromise: Promise<void> | null = null;
	private readonly serviceLogger = createChildLogger({ service: 'AnnotationIndexService' });

	constructor(
		private readonly repository: AnnotationRepositoryPort,
		private readonly storage: StoragePort
	) {}

	get isReconciling(): boolean {
		return this.reconcilePromise !== null;
	}

	async indexSource(input: {
		bookId: number;
		source: string;
		progressUpdatedAt: string | null;
	}): Promise<void> {
		try {
			const snapshot = parseKoreaderSidecar(input.source);
			await this.repository.replaceForBook({
				bookId: input.bookId,
				annotations: snapshot.annotations,
				sourceProgressUpdatedAt: input.progressUpdatedAt,
				parserVersion: KOREADER_ANNOTATION_PARSER_VERSION
			});
		} catch (error: unknown) {
			try {
				await this.repository.markFailed({
					bookId: input.bookId,
					sourceProgressUpdatedAt: input.progressUpdatedAt,
					parserVersion: KOREADER_ANNOTATION_PARSER_VERSION,
					error: safeError(error)
				});
			} catch (markError: unknown) {
				this.serviceLogger.error(
					{ event: 'annotation.index.failure_state_failed', bookId: input.bookId, error: toLogError(markError) },
					'Failed to persist annotation index failure state'
				);
			}
			throw error;
		}
	}

	async tryIndexSource(input: {
		bookId: number;
		source: string;
		progressUpdatedAt: string | null;
	}): Promise<boolean> {
		try {
			await this.indexSource(input);
			return true;
		} catch (error: unknown) {
			this.serviceLogger.warn(
				{ event: 'annotation.index.failed', bookId: input.bookId, error: toLogError(error) },
				'Annotation indexing failed without rejecting progress sync'
			);
			return false;
		}
	}

	startReconciliation(bookId?: number): void {
		if (this.reconcilePromise) return;
		this.reconcilePromise = this.reconcile(bookId)
			.catch((error: unknown) => {
				this.serviceLogger.error(
					{ event: 'annotation.reconcile.failed', error: toLogError(error) },
					'Annotation reconciliation failed'
				);
			})
			.finally(() => {
				this.reconcilePromise = null;
			});
	}

	async getSummary() {
		const summary = await this.repository.getIndexSummary(KOREADER_ANNOTATION_PARSER_VERSION);
		return { ...summary, isReconciling: this.isReconciling };
	}

	private async reconcile(bookId?: number): Promise<void> {
		const candidates = await this.repository.listIndexCandidates(
			KOREADER_ANNOTATION_PARSER_VERSION,
			bookId
		);
		let nextIndex = 0;
		const worker = async (): Promise<void> => {
			while (nextIndex < candidates.length) {
				const candidate = candidates[nextIndex++];
				try {
					const source = (await this.storage.get(`library/${candidate.progressStorageKey}`)).toString('utf8');
					await this.indexSource({
						bookId: candidate.bookId,
						source,
						progressUpdatedAt: candidate.progressUpdatedAt
					});
				} catch (error: unknown) {
					this.serviceLogger.warn(
						{ event: 'annotation.reconcile.book_failed', bookId: candidate.bookId, error: toLogError(error) },
						'Failed to reconcile book annotations'
					);
				}
			}
		};
		await Promise.all(
			Array.from({ length: Math.min(RECONCILE_CONCURRENCY, candidates.length) }, () => worker())
		);
	}
}
