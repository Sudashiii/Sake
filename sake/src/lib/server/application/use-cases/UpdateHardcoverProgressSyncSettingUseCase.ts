import { apiError, type ApiResult } from '$lib/server/http/api';
import type { HardcoverProgressSyncStatus } from '$lib/types/Integrations/HardcoverProgress';
import { HardcoverProgressSettingsRepository } from '$lib/server/infrastructure/repositories/HardcoverProgressSettingsRepository';
import type { HardcoverProgressSyncPort } from '$lib/server/application/ports/HardcoverProgressSyncPort';
import { GetHardcoverProgressSyncStatusUseCase } from './GetHardcoverProgressSyncStatusUseCase';

export class UpdateHardcoverProgressSyncSettingUseCase {
	constructor(
		private readonly settings: HardcoverProgressSettingsRepository,
		private readonly sync: HardcoverProgressSyncPort,
		private readonly status: GetHardcoverProgressSyncStatusUseCase,
		private readonly tokenConfigured: boolean
	) {}

	async execute(input: { enabled: boolean }): Promise<ApiResult<HardcoverProgressSyncStatus>> {
		if (input.enabled && !this.tokenConfigured) {
			return apiError('HARDCOVER_API_TOKEN is not configured', 409);
		}
		if (input.enabled && /^(1|true|yes|on)$/i.test(process.env.SAKE_DEMO_MODE?.trim() ?? '')) {
			return apiError('Hardcover progress sync is unavailable in demo mode', 403);
		}
		await this.settings.setEnabled(input.enabled);
		if (input.enabled) await this.sync.reconcile(true);
		return this.status.execute();
	}
}
