import type { SidecarWriteCoordinator } from '$lib/server/application/services/SidecarWriteCoordinator';
import type {
	PersistProgressResult,
	ProgressPersistenceService
} from '$lib/server/application/services/ProgressPersistenceService';
import type { ProgressBookResolver } from '$lib/server/application/services/ProgressBookResolver';
import type { ApiResult } from '$lib/server/http/api';

export interface PutProgressInput {
	fileName: string;
	fileData: ArrayBuffer;
	percentFinished: number;
	deviceId?: string;
	readerSessionId?: string;
}

export class PutProgressUseCase {
	constructor(
		private readonly progressBookResolver: ProgressBookResolver,
		private readonly progressPersistenceService: ProgressPersistenceService,
		private readonly sidecarWriteCoordinator?: SidecarWriteCoordinator
	) {}

	async execute(input: PutProgressInput): Promise<ApiResult<PersistProgressResult>> {
		const resolved = await this.progressBookResolver.resolve(input.fileName);
		if (!resolved.ok) return resolved;

		const persist = () =>
			this.progressPersistenceService.persist({
				book: resolved.value.book,
				progressKey: resolved.value.progressKey,
				fileData: Buffer.from(input.fileData),
				percentFinished: input.percentFinished,
				deviceId: input.deviceId,
				readerSessionId: input.readerSessionId
			});

		return this.sidecarWriteCoordinator
			? this.sidecarWriteCoordinator.run(resolved.value.book.id, persist)
			: persist();
	}
}
