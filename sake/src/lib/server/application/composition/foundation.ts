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
import { resolveZLibraryMirrorUrls } from '$lib/server/config/zlibrary';
import { resolveAnnaArchiveMirrorUrls } from '$lib/server/config/annaArchive';
import { AnnotationRepository } from '$lib/server/infrastructure/repositories/AnnotationRepository';
import { AnnotationIndexService } from '$lib/server/application/services/AnnotationIndexService';
import { SidecarWriteCoordinator } from '$lib/server/application/services/SidecarWriteCoordinator';
import { ZLibraryMirrorSettingsRepository } from '$lib/server/infrastructure/repositories/ZLibraryMirrorSettingsRepository';
import {
	GetZLibraryMirrorSettingsUseCase,
	UpdateZLibraryMirrorSettingsUseCase
} from '$lib/server/application/use-cases/ZLibraryMirrorSettingsUseCases';
import { AnnaArchiveMirrorSettingsRepository } from '$lib/server/infrastructure/repositories/AnnaArchiveMirrorSettingsRepository';
import {
	GetAnnaArchiveMirrorSettingsUseCase,
	UpdateAnnaArchiveMirrorSettingsUseCase
} from '$lib/server/application/use-cases/AnnaArchiveMirrorSettingsUseCases';

export const zlibraryMirrorSettingsRepository = new ZLibraryMirrorSettingsRepository(
	resolveZLibraryMirrorUrls(env.ZLIBRARY_BASE_URL)
);
export const getZLibraryMirrorUrls = () => zlibraryMirrorSettingsRepository.get();
export const zlibraryClient = new ZLibraryClient(getZLibraryMirrorUrls);
export const getZLibraryMirrorSettingsUseCase = new GetZLibraryMirrorSettingsUseCase(
	zlibraryMirrorSettingsRepository
);
export const updateZLibraryMirrorSettingsUseCase = new UpdateZLibraryMirrorSettingsUseCase(
	zlibraryMirrorSettingsRepository
);
export const annaArchiveMirrorSettingsRepository = new AnnaArchiveMirrorSettingsRepository(
	resolveAnnaArchiveMirrorUrls(env.ANNA_ARCHIVE_BASE_URL)
);
export const getAnnaArchiveMirrorUrls = () => annaArchiveMirrorSettingsRepository.get();
export const getAnnaArchiveMirrorSettingsUseCase = new GetAnnaArchiveMirrorSettingsUseCase(
	annaArchiveMirrorSettingsRepository
);
export const updateAnnaArchiveMirrorSettingsUseCase = new UpdateAnnaArchiveMirrorSettingsUseCase(
	annaArchiveMirrorSettingsRepository
);
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
export const annotationRepository = new AnnotationRepository();
export const annotationIndexService = new AnnotationIndexService(annotationRepository, storage);
export const sidecarWriteCoordinator = new SidecarWriteCoordinator();
export const managedBookCoverService = new ManagedBookCoverService(
	storage,
	fetch,
	getZLibraryMirrorUrls,
	getAnnaArchiveMirrorUrls
);

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
