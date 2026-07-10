import { SyncKoreaderPluginReleaseUseCase } from '$lib/server/application/use-cases/SyncKoreaderPluginReleaseUseCase';
import { GetLatestKoreaderPluginUseCase } from '$lib/server/application/use-cases/GetLatestKoreaderPluginUseCase';
import { GetKoreaderPluginDownloadUseCase } from '$lib/server/application/use-cases/GetKoreaderPluginDownloadUseCase';
import { ListKoreaderPluginReleasesUseCase } from '$lib/server/application/use-cases/ListKoreaderPluginReleasesUseCase';
import { GetKoreaderPluginUpstreamVersionUseCase } from '$lib/server/application/use-cases/GetKoreaderPluginUpstreamVersionUseCase';
import { GetAppVersionUseCase } from '$lib/server/application/use-cases/GetAppVersionUseCase';
import { ObserveWebappLogsUseCase } from '$lib/server/application/use-cases/ObserveWebappLogsUseCase';
import { AppendDeviceLogUseCase } from '$lib/server/application/use-cases/AppendDeviceLogUseCase';
import { ObserveDeviceLogsUseCase } from '$lib/server/application/use-cases/ObserveDeviceLogsUseCase';
import { GetHardcoverProgressSyncStatusUseCase } from '$lib/server/application/use-cases/GetHardcoverProgressSyncStatusUseCase';
import { UpdateHardcoverProgressSyncSettingUseCase } from '$lib/server/application/use-cases/UpdateHardcoverProgressSyncSettingUseCase';
import { TriggerHardcoverProgressSyncUseCase } from '$lib/server/application/use-cases/TriggerHardcoverProgressSyncUseCase';
import { webappLogFeed } from '$lib/server/infrastructure/logging/webappLogFeed';
import { deviceLogFeed } from '$lib/server/infrastructure/logging/deviceLogFeed';
import {
	deviceRepository,
	hardcoverApiToken,
	hardcoverProgressSettingsRepository,
	hardcoverProgressSyncJobRepository,
	hardcoverProgressSyncService,
	koreaderPluginArtifactService,
	migrationStatusRepository,
	pluginReleaseRepository,
	storage
} from './foundation';

export const syncKoreaderPluginReleaseUseCase = new SyncKoreaderPluginReleaseUseCase(
	storage,
	pluginReleaseRepository,
	koreaderPluginArtifactService
);
export const getLatestKoreaderPluginUseCase = new GetLatestKoreaderPluginUseCase(pluginReleaseRepository);
export const listKoreaderPluginReleasesUseCase = new ListKoreaderPluginReleasesUseCase(
	pluginReleaseRepository
);
export const getKoreaderPluginUpstreamVersionUseCase =
	new GetKoreaderPluginUpstreamVersionUseCase(pluginReleaseRepository);
export const getKoreaderPluginDownloadUseCase = new GetKoreaderPluginDownloadUseCase(
	storage,
	pluginReleaseRepository
);
export const getAppVersionUseCase = new GetAppVersionUseCase(migrationStatusRepository);
export const observeWebappLogsUseCase = new ObserveWebappLogsUseCase(webappLogFeed);
export const appendDeviceLogUseCase = new AppendDeviceLogUseCase(deviceRepository, deviceLogFeed);
export const observeDeviceLogsUseCase = new ObserveDeviceLogsUseCase(deviceRepository, deviceLogFeed);
export const getHardcoverProgressSyncStatusUseCase = new GetHardcoverProgressSyncStatusUseCase(
	hardcoverProgressSettingsRepository,
	hardcoverProgressSyncJobRepository,
	Boolean(hardcoverApiToken)
);
export const updateHardcoverProgressSyncSettingUseCase =
	new UpdateHardcoverProgressSyncSettingUseCase(
		hardcoverProgressSettingsRepository,
		hardcoverProgressSyncService,
		getHardcoverProgressSyncStatusUseCase,
		Boolean(hardcoverApiToken)
	);
export const triggerHardcoverProgressSyncUseCase = new TriggerHardcoverProgressSyncUseCase(
	hardcoverProgressSyncService,
	Boolean(hardcoverApiToken)
);
