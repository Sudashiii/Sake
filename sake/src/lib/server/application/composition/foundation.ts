import { env } from '$env/dynamic/private';
import { ZLibraryClient } from '$lib/server/infrastructure/clients/ZLibraryClient';
import { S3Storage } from '$lib/server/infrastructure/storage/S3Storage';
import { BookRepository } from '$lib/server/infrastructure/repositories/BookRepository';
import { ShelfRepository } from '$lib/server/infrastructure/repositories/ShelfRepository';
import { DeviceDownloadRepository } from '$lib/server/infrastructure/repositories/DeviceDownloadRepository';
import { DeviceProgressDownloadRepository } from '$lib/server/infrastructure/repositories/DeviceProgressDownloadRepository';
import { BookProgressHistoryRepository } from '$lib/server/infrastructure/repositories/BookProgressHistoryRepository';
import { PluginReleaseRepository } from '$lib/server/infrastructure/repositories/PluginReleaseRepository';
import { UserRepository } from '$lib/server/infrastructure/repositories/UserRepository';
import { UserSessionRepository } from '$lib/server/infrastructure/repositories/UserSessionRepository';
import { UserApiKeyRepository } from '$lib/server/infrastructure/repositories/UserApiKeyRepository';
import { DeviceRepository } from '$lib/server/infrastructure/repositories/DeviceRepository';
import { MigrationStatusRepository } from '$lib/server/infrastructure/repositories/MigrationStatusRepository';
import { KoreaderPluginArtifactService } from '$lib/server/application/services/KoreaderPluginArtifactService';
import { ManagedBookCoverService } from '$lib/server/application/services/ManagedBookCoverService';
import { HardcoverClient } from '$lib/server/infrastructure/clients/HardcoverClient';
import { HardcoverProgressSettingsRepository } from '$lib/server/infrastructure/repositories/HardcoverProgressSettingsRepository';
import { HardcoverProgressSyncJobRepository } from '$lib/server/infrastructure/repositories/HardcoverProgressSyncJobRepository';
import { HardcoverProgressSyncService } from '$lib/server/application/services/HardcoverProgressSyncService';
import { createLazySingleton } from '$lib/server/utils/createLazySingleton';

export const zlibraryClient = new ZLibraryClient('https://1lib.sk');
export const storage = createLazySingleton(() => new S3Storage());
export const koreaderPluginArtifactService = new KoreaderPluginArtifactService();
export const pluginReleaseRepository = new PluginReleaseRepository();
export const migrationStatusRepository = new MigrationStatusRepository();
export const deviceRepository = new DeviceRepository();
export const userRepository = new UserRepository();
export const userSessionRepository = new UserSessionRepository();
export const userApiKeyRepository = new UserApiKeyRepository();
export const bookRepository = new BookRepository();
export const shelfRepository = new ShelfRepository();
export const deviceDownloadRepository = new DeviceDownloadRepository();
export const deviceProgressDownloadRepository = new DeviceProgressDownloadRepository();
export const bookProgressHistoryRepository = new BookProgressHistoryRepository();
export const managedBookCoverService = new ManagedBookCoverService(storage);

export const hardcoverApiToken = env.HARDCOVER_API_TOKEN?.trim() || null;
export const hardcoverClient = hardcoverApiToken ? new HardcoverClient(hardcoverApiToken) : null;
export const hardcoverProgressSettingsRepository = new HardcoverProgressSettingsRepository();
export const hardcoverProgressSyncJobRepository = new HardcoverProgressSyncJobRepository();
export const hardcoverProgressSyncService = new HardcoverProgressSyncService(
	bookRepository,
	hardcoverProgressSettingsRepository,
	hardcoverProgressSyncJobRepository,
	hardcoverClient
);
