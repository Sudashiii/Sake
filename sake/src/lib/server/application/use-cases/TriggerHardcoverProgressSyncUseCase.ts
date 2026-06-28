import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import type { HardcoverProgressSyncPort } from '$lib/server/application/ports/HardcoverProgressSyncPort';
import type { TriggerHardcoverProgressSyncResponse } from '$lib/types/Integrations/HardcoverProgress';

export class TriggerHardcoverProgressSyncUseCase {
	constructor(
		private readonly sync: HardcoverProgressSyncPort,
		private readonly tokenConfigured: boolean
	) {}

	async execute(): Promise<ApiResult<TriggerHardcoverProgressSyncResponse>> {
		if (!this.tokenConfigured) return apiError('HARDCOVER_API_TOKEN is not configured', 409);
		if (/^(1|true|yes|on)$/i.test(process.env.SAKE_DEMO_MODE?.trim() ?? '')) {
			return apiError('Hardcover progress sync is unavailable in demo mode', 403);
		}
		if (!(await this.sync.isEnabled())) {
			return apiError('Hardcover progress sync is disabled', 409);
		}
		const enqueued = await this.sync.reconcile(true);
		return apiOk({ success: true, enqueued });
	}
}
