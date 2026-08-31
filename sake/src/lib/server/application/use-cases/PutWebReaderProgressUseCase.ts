import {
	mergeKoreaderSidecar,
	koreaderLocalDate,
	parseKoreaderSidecar,
	type SidecarChanges,
	type SidecarSnapshot
} from '$lib/koreader/koreaderSidecar';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import type { ProgressBookResolver } from '$lib/server/application/services/ProgressBookResolver';
import type { ProgressPersistenceService } from '$lib/server/application/services/ProgressPersistenceService';
import type { SidecarWriteCoordinator } from '$lib/server/application/services/SidecarWriteCoordinator';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import { createChildLogger, toLogError } from '$lib/server/infrastructure/logging/logger';

export interface PutWebReaderProgressInput {
	fileName: string;
	changes: SidecarChanges;
	readerSessionId: string;
}

export interface PutWebReaderProgressResult {
	progressKey: string;
	sidecar: SidecarSnapshot;
}

export class PutWebReaderProgressUseCase {
	private readonly useCaseLogger = createChildLogger({ useCase: 'PutWebReaderProgressUseCase' });

	constructor(
		private readonly progressBookResolver: ProgressBookResolver,
		private readonly storage: StoragePort,
		private readonly progressPersistenceService: ProgressPersistenceService,
		private readonly sidecarWriteCoordinator: SidecarWriteCoordinator
	) {}

	async execute(
		input: PutWebReaderProgressInput
	): Promise<ApiResult<PutWebReaderProgressResult>> {
		const resolved = await this.progressBookResolver.resolve(input.fileName);
		if (!resolved.ok) return resolved;

		const { book, progressKey } = resolved.value;
		return this.sidecarWriteCoordinator.run(book.id, async () => {
			const latestSource = await this.readLatestSource(progressKey);
			if (!latestSource.ok) return latestSource;

			let merged: SidecarSnapshot;
			try {
				merged = mergeKoreaderSidecar(
					latestSource.value,
					input.changes,
					koreaderLocalDate()
				);
				parseKoreaderSidecar(merged.source);
			} catch (cause: unknown) {
				this.useCaseLogger.warn(
					{
						event: 'progress.web.sidecar.invalid',
						bookId: book.id,
						progressKey,
						error: toLogError(cause)
					},
					'Web reader refused to replace an uneditable progress sidecar'
				);
				return apiError('Progress sidecar cannot be edited safely', 409, cause);
			}

			const persisted = await this.progressPersistenceService.persist({
				book,
				progressKey,
				fileData: Buffer.from(merged.source, 'utf8'),
				percentFinished: merged.percentFinished,
				readerSessionId: input.readerSessionId
			});
			if (!persisted.ok) return persisted;

			return apiOk({ progressKey, sidecar: merged });
		});
	}

	private async readLatestSource(progressKey: string): Promise<ApiResult<string | null>> {
		const storageKey = `library/${progressKey}`;
		try {
			if (this.storage.exists && !(await this.storage.exists(storageKey))) {
				return apiOk(null);
			}
			return apiOk((await this.storage.get(storageKey)).toString('utf8'));
		} catch (cause: unknown) {
			this.useCaseLogger.error(
				{
					event: 'progress.web.sidecar.read_failed',
					progressKey,
					error: toLogError(cause)
				},
				'Failed to read the latest progress sidecar for web merge'
			);
			return apiError('Failed to read existing progress sidecar', 500, cause);
		}
	}
}
