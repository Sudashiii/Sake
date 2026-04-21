import { ZLibraryClient } from '$lib/server/infrastructure/clients/ZLibraryClient';
import { S3Storage } from '$lib/server/infrastructure/storage/S3Storage';
import { BookRepository } from '$lib/server/infrastructure/repositories/BookRepository';
import { ShelfRepository } from '$lib/server/infrastructure/repositories/ShelfRepository';
import { DeviceDownloadRepository } from '$lib/server/infrastructure/repositories/DeviceDownloadRepository';
import { DeviceProgressDownloadRepository } from '$lib/server/infrastructure/repositories/DeviceProgressDownloadRepository';
import { BookProgressHistoryRepository } from '$lib/server/infrastructure/repositories/BookProgressHistoryRepository';
import { DavUploadServiceFactory } from '$lib/server/infrastructure/factories/DavUploadServiceFactory';
import { downloadQueue } from '$lib/server/infrastructure/queue/downloadQueue';
import { DownloadBookUseCase } from '$lib/server/application/use-cases/DownloadBookUseCase';
import { QueueDownloadUseCase } from '$lib/server/application/use-cases/QueueDownloadUseCase';
import { QueueSearchBookUseCase } from '$lib/server/application/use-cases/QueueSearchBookUseCase';
import { GetQueueStatusUseCase } from '$lib/server/application/use-cases/GetQueueStatusUseCase';
import { ZLibrarySearchUseCase } from '$lib/server/application/use-cases/ZLibrarySearchUseCase';
import { ZLibraryTokenLoginUseCase } from '$lib/server/application/use-cases/ZLibraryTokenLoginUseCase';
import { ZLibraryPasswordLoginUseCase } from '$lib/server/application/use-cases/ZLibraryPasswordLoginUseCase';
import { ZLibraryLogoutUseCase } from '$lib/server/application/use-cases/ZLibraryLogoutUseCase';
import { ListLibraryUseCase } from '$lib/server/application/use-cases/ListLibraryUseCase';
import {
	GetLibraryBookDetailUseCase
} from '$lib/server/application/use-cases/GetLibraryBookDetailUseCase';
import {
	RefetchLibraryBookMetadataUseCase
} from '$lib/server/application/use-cases/RefetchLibraryBookMetadataUseCase';
import { GetNewBooksForDeviceUseCase } from '$lib/server/application/use-cases/GetNewBooksForDeviceUseCase';
import { ConfirmDownloadUseCase } from '$lib/server/application/use-cases/ConfirmDownloadUseCase';
import { RemoveDeviceDownloadUseCase } from '$lib/server/application/use-cases/RemoveDeviceDownloadUseCase';
import { ResetDownloadStatusUseCase } from '$lib/server/application/use-cases/ResetDownloadStatusUseCase';
import { GetProgressUseCase } from '$lib/server/application/use-cases/GetProgressUseCase';
import { PutProgressUseCase } from '$lib/server/application/use-cases/PutProgressUseCase';
import { GetBookProgressHistoryUseCase } from '$lib/server/application/use-cases/GetBookProgressHistoryUseCase';
import { GetNewProgressForDeviceUseCase } from '$lib/server/application/use-cases/GetNewProgressForDeviceUseCase';
import { ConfirmProgressDownloadUseCase } from '$lib/server/application/use-cases/ConfirmProgressDownloadUseCase';
import { GetLibraryFileUseCase } from '$lib/server/application/use-cases/GetLibraryFileUseCase';
import { PutLibraryFileUseCase } from '$lib/server/application/use-cases/PutLibraryFileUseCase';
import { DeleteLibraryFileUseCase } from '$lib/server/application/use-cases/DeleteLibraryFileUseCase';
import { ListDavDirectoryUseCase } from '$lib/server/application/use-cases/ListDavDirectoryUseCase';
import { MoveLibraryBookToTrashUseCase } from '$lib/server/application/use-cases/MoveLibraryBookToTrashUseCase';
import { ListLibraryTrashUseCase } from '$lib/server/application/use-cases/ListLibraryTrashUseCase';
import { RestoreLibraryBookUseCase } from '$lib/server/application/use-cases/RestoreLibraryBookUseCase';
import { DeleteTrashedLibraryBookUseCase } from '$lib/server/application/use-cases/DeleteTrashedLibraryBookUseCase';
import { PurgeExpiredTrashUseCase } from '$lib/server/application/use-cases/PurgeExpiredTrashUseCase';
import { KoreaderPluginArtifactService } from '$lib/server/application/services/KoreaderPluginArtifactService';
import { SyncKoreaderPluginReleaseUseCase } from '$lib/server/application/use-cases/SyncKoreaderPluginReleaseUseCase';
import { GetLatestKoreaderPluginUseCase } from '$lib/server/application/use-cases/GetLatestKoreaderPluginUseCase';
import { GetKoreaderPluginDownloadUseCase } from '$lib/server/application/use-cases/GetKoreaderPluginDownloadUseCase';
import { ListKoreaderPluginReleasesUseCase } from '$lib/server/application/use-cases/ListKoreaderPluginReleasesUseCase';
import { PluginReleaseRepository } from '$lib/server/infrastructure/repositories/PluginReleaseRepository';
import { UserRepository } from '$lib/server/infrastructure/repositories/UserRepository';
import { UserSessionRepository } from '$lib/server/infrastructure/repositories/UserSessionRepository';
import { UserApiKeyRepository } from '$lib/server/infrastructure/repositories/UserApiKeyRepository';
import { DeviceRepository } from '$lib/server/infrastructure/repositories/DeviceRepository';
import { UpdateBookRatingUseCase } from '$lib/server/application/use-cases/UpdateBookRatingUseCase';
import { ListLibraryRatingsUseCase } from '$lib/server/application/use-cases/ListLibraryRatingsUseCase';
import { UpdateLibraryBookStateUseCase } from '$lib/server/application/use-cases/UpdateLibraryBookStateUseCase';
import { UpdateLibraryBookMetadataUseCase } from '$lib/server/application/use-cases/UpdateLibraryBookMetadataUseCase';
import { GetReadingActivityStatsUseCase } from '$lib/server/application/use-cases/GetReadingActivityStatsUseCase';
import { ListShelvesUseCase } from '$lib/server/application/use-cases/ListShelvesUseCase';
import { CreateShelfUseCase } from '$lib/server/application/use-cases/CreateShelfUseCase';
import { UpdateShelfUseCase } from '$lib/server/application/use-cases/UpdateShelfUseCase';
import { UpdateShelfRulesUseCase } from '$lib/server/application/use-cases/UpdateShelfRulesUseCase';
import { ReorderShelvesUseCase } from '$lib/server/application/use-cases/ReorderShelvesUseCase';
import { DeleteShelfUseCase } from '$lib/server/application/use-cases/DeleteShelfUseCase';
import { SetBookShelvesUseCase } from '$lib/server/application/use-cases/SetBookShelvesUseCase';
import { LookupSearchBookMetadataUseCase } from '$lib/server/application/use-cases/LookupSearchBookMetadataUseCase';
import { SearchBooksUseCase } from '$lib/server/application/use-cases/SearchBooksUseCase';
import { createSearchProviders } from '$lib/server/infrastructure/search-providers/searchProviderFactory';
import { DownloadSearchBookUseCase } from '$lib/server/application/use-cases/DownloadSearchBookUseCase';
import { GetAuthStatusUseCase } from '$lib/server/application/use-cases/GetAuthStatusUseCase';
import { BootstrapLocalAccountUseCase } from '$lib/server/application/use-cases/BootstrapLocalAccountUseCase';
import { LoginLocalAccountUseCase } from '$lib/server/application/use-cases/LoginLocalAccountUseCase';
import { GetCurrentUserUseCase } from '$lib/server/application/use-cases/GetCurrentUserUseCase';
import { SetBasicAuthPasswordUseCase } from '$lib/server/application/use-cases/SetBasicAuthPasswordUseCase';
import { ClearBasicAuthPasswordUseCase } from '$lib/server/application/use-cases/ClearBasicAuthPasswordUseCase';
import { LogoutLocalAccountUseCase } from '$lib/server/application/use-cases/LogoutLocalAccountUseCase';
import { LogoutAllLocalSessionsUseCase } from '$lib/server/application/use-cases/LogoutAllLocalSessionsUseCase';
import { CreateDeviceApiKeyUseCase } from '$lib/server/application/use-cases/CreateDeviceApiKeyUseCase';
import { ListActiveApiKeysUseCase } from '$lib/server/application/use-cases/ListActiveApiKeysUseCase';
import { RevokeApiKeyUseCase } from '$lib/server/application/use-cases/RevokeApiKeyUseCase';
import { ResolveRequestAuthUseCase } from '$lib/server/application/use-cases/ResolveRequestAuthUseCase';
import { ReportDeviceVersionUseCase } from '$lib/server/application/use-cases/ReportDeviceVersionUseCase';
import { ListDevicesUseCase } from '$lib/server/application/use-cases/ListDevicesUseCase';
import { DeleteDeviceUseCase } from '$lib/server/application/use-cases/DeleteDeviceUseCase';
import { GetAppVersionUseCase } from '$lib/server/application/use-cases/GetAppVersionUseCase';
import { getActivatedSearchProviders } from '$lib/server/config/activatedProviders';
import { SEARCH_PROVIDER_IDS } from '$lib/types/Search/Provider';
import { MetadataAggregatorService } from '$lib/server/application/services/MetadataAggregatorService';
import { ExternalBookMetadataService } from '$lib/server/application/services/ExternalBookMetadataService';
import { GoogleBooksMetadataProvider } from '$lib/server/infrastructure/metadata-providers/googleBooksMetadataProvider';
import { OpenLibraryMetadataProvider } from '$lib/server/infrastructure/metadata-providers/openLibraryMetadataProvider';
import { ManagedBookCoverService } from '$lib/server/application/services/ManagedBookCoverService';
import { GetLibraryCoverUseCase } from '$lib/server/application/use-cases/GetLibraryCoverUseCase';
import { ImportLibraryBookCoverUseCase } from '$lib/server/application/use-cases/ImportLibraryBookCoverUseCase';
import { UploadLibraryBookCoverUseCase } from '$lib/server/application/use-cases/UploadLibraryBookCoverUseCase';
import { ExportDeviceLibraryBookUseCase } from '$lib/server/application/use-cases/ExportDeviceLibraryBookUseCase';
import { createLazySingleton } from '$lib/server/utils/createLazySingleton';
import { webappLogFeed } from '$lib/server/infrastructure/logging/webappLogFeed';
import { ObserveWebappLogsUseCase } from '$lib/server/application/use-cases/ObserveWebappLogsUseCase';
import { deviceLogFeed } from '$lib/server/infrastructure/logging/deviceLogFeed';
import { AppendDeviceLogUseCase } from '$lib/server/application/use-cases/AppendDeviceLogUseCase';
import { ObserveDeviceLogsUseCase } from '$lib/server/application/use-cases/ObserveDeviceLogsUseCase';
import { MigrationStatusRepository } from '$lib/server/infrastructure/repositories/MigrationStatusRepository';

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

export const baselineMetadataAggregator = new MetadataAggregatorService([
	new GoogleBooksMetadataProvider(),
	new OpenLibraryMetadataProvider()
]);
export const externalBookMetadataService = new ExternalBookMetadataService(
	baselineMetadataAggregator
);

export const downloadBookUseCase = new DownloadBookUseCase(
	zlibraryClient,
	bookRepository,
	storage,
	() => DavUploadServiceFactory.createS3(),
	managedBookCoverService,
	undefined,
	externalBookMetadataService
);
export const queueDownloadUseCase = new QueueDownloadUseCase(downloadQueue);
export const queueSearchBookUseCase = new QueueSearchBookUseCase(downloadQueue);
export const getQueueStatusUseCase = new GetQueueStatusUseCase(downloadQueue);
export const zlibrarySearchUseCase = new ZLibrarySearchUseCase(zlibraryClient);
export const lookupSearchBookMetadataUseCase = new LookupSearchBookMetadataUseCase();
const activeSearchProviders = getActivatedSearchProviders();
const searchProviderDependencies = { zlibrary: zlibraryClient };
const activeSearchProviderInstances = createSearchProviders(
	activeSearchProviders,
	searchProviderDependencies
);
const allSearchProviderInstances = createSearchProviders(
	[...SEARCH_PROVIDER_IDS],
	searchProviderDependencies
);

export const searchBooksUseCase = new SearchBooksUseCase(
	activeSearchProviderInstances,
	activeSearchProviders
);
export const downloadSearchBookUseCase = new DownloadSearchBookUseCase(allSearchProviderInstances);
export const zlibraryTokenLoginUseCase = new ZLibraryTokenLoginUseCase(zlibraryClient);
export const zlibraryPasswordLoginUseCase = new ZLibraryPasswordLoginUseCase(zlibraryClient);
export const zlibraryLogoutUseCase = new ZLibraryLogoutUseCase();

export const listLibraryUseCase = new ListLibraryUseCase(bookRepository, shelfRepository);
export const getLibraryBookDetailUseCase = new GetLibraryBookDetailUseCase(
	bookRepository,
	deviceDownloadRepository,
	shelfRepository
);
export const refetchLibraryBookMetadataUseCase = new RefetchLibraryBookMetadataUseCase(
	bookRepository,
	externalBookMetadataService
);
export const getNewBooksForDeviceUseCase = new GetNewBooksForDeviceUseCase(bookRepository);
export const confirmDownloadUseCase = new ConfirmDownloadUseCase(deviceDownloadRepository);
export const removeDeviceDownloadUseCase = new RemoveDeviceDownloadUseCase(deviceDownloadRepository);
export const resetDownloadStatusUseCase = new ResetDownloadStatusUseCase(bookRepository);

export const getProgressUseCase = new GetProgressUseCase(bookRepository, storage);
export const putProgressUseCase = new PutProgressUseCase(
	bookRepository,
	bookProgressHistoryRepository,
	storage,
	deviceProgressDownloadRepository
);
export const getBookProgressHistoryUseCase = new GetBookProgressHistoryUseCase(
	bookRepository,
	bookProgressHistoryRepository
);
export const getNewProgressForDeviceUseCase = new GetNewProgressForDeviceUseCase(bookRepository);
export const confirmProgressDownloadUseCase = new ConfirmProgressDownloadUseCase(
	bookRepository,
	deviceProgressDownloadRepository
);

export const getLibraryFileUseCase = new GetLibraryFileUseCase(storage);
export const getLibraryCoverUseCase = new GetLibraryCoverUseCase(storage);
export const importLibraryBookCoverUseCase = new ImportLibraryBookCoverUseCase(
	bookRepository,
	managedBookCoverService
);
export const uploadLibraryBookCoverUseCase = new UploadLibraryBookCoverUseCase(
	bookRepository,
	managedBookCoverService
);
export const putLibraryFileUseCase = new PutLibraryFileUseCase(
	storage,
	bookRepository,
	managedBookCoverService
);
export const exportDeviceLibraryBookUseCase = new ExportDeviceLibraryBookUseCase(
	bookRepository,
	deviceDownloadRepository,
	deviceProgressDownloadRepository,
	storage,
	putLibraryFileUseCase
);
export const deleteLibraryFileUseCase = new DeleteLibraryFileUseCase(storage);
export const listDavDirectoryUseCase = new ListDavDirectoryUseCase(storage);
export const moveLibraryBookToTrashUseCase = new MoveLibraryBookToTrashUseCase(bookRepository);
export const listLibraryTrashUseCase = new ListLibraryTrashUseCase(bookRepository);
export const restoreLibraryBookUseCase = new RestoreLibraryBookUseCase(bookRepository);
export const deleteTrashedLibraryBookUseCase = new DeleteTrashedLibraryBookUseCase(
	bookRepository,
	storage,
	managedBookCoverService
);
export const purgeExpiredTrashUseCase = new PurgeExpiredTrashUseCase(
	bookRepository,
	storage,
	managedBookCoverService
);
export const syncKoreaderPluginReleaseUseCase = new SyncKoreaderPluginReleaseUseCase(
	storage,
	pluginReleaseRepository,
	koreaderPluginArtifactService
);
export const getLatestKoreaderPluginUseCase = new GetLatestKoreaderPluginUseCase(pluginReleaseRepository);
export const listKoreaderPluginReleasesUseCase = new ListKoreaderPluginReleasesUseCase(
	pluginReleaseRepository
);
export const getKoreaderPluginDownloadUseCase = new GetKoreaderPluginDownloadUseCase(
	storage,
	pluginReleaseRepository
);
export const getAuthStatusUseCase = new GetAuthStatusUseCase(userRepository);
export const bootstrapLocalAccountUseCase = new BootstrapLocalAccountUseCase(
	userRepository,
	userSessionRepository
);
export const loginLocalAccountUseCase = new LoginLocalAccountUseCase(
	userRepository,
	userSessionRepository
);
export const getCurrentUserUseCase = new GetCurrentUserUseCase(userRepository);
export const setBasicAuthPasswordUseCase = new SetBasicAuthPasswordUseCase(userRepository);
export const clearBasicAuthPasswordUseCase = new ClearBasicAuthPasswordUseCase(userRepository);
export const logoutLocalAccountUseCase = new LogoutLocalAccountUseCase(userSessionRepository);
export const logoutAllLocalSessionsUseCase = new LogoutAllLocalSessionsUseCase(userSessionRepository);
export const createDeviceApiKeyUseCase = new CreateDeviceApiKeyUseCase(
	userRepository,
	userApiKeyRepository,
	deviceRepository
);
export const listActiveApiKeysUseCase = new ListActiveApiKeysUseCase(userApiKeyRepository);
export const revokeApiKeyUseCase = new RevokeApiKeyUseCase(userApiKeyRepository);
export const resolveRequestAuthUseCase = new ResolveRequestAuthUseCase(
	userRepository,
	userSessionRepository,
	userApiKeyRepository
);
export const reportDeviceVersionUseCase = new ReportDeviceVersionUseCase(deviceRepository);
export const getAppVersionUseCase = new GetAppVersionUseCase(migrationStatusRepository);
export const listDevicesUseCase = new ListDevicesUseCase(deviceRepository, userApiKeyRepository);
export const deleteDeviceUseCase = new DeleteDeviceUseCase(
	deviceRepository,
	userApiKeyRepository,
	deviceDownloadRepository,
	deviceProgressDownloadRepository
);
export const observeWebappLogsUseCase = new ObserveWebappLogsUseCase(webappLogFeed);
export const appendDeviceLogUseCase = new AppendDeviceLogUseCase(deviceRepository, deviceLogFeed);
export const observeDeviceLogsUseCase = new ObserveDeviceLogsUseCase(deviceRepository, deviceLogFeed);
export const updateBookRatingUseCase = new UpdateBookRatingUseCase(bookRepository);
export const listLibraryRatingsUseCase = new ListLibraryRatingsUseCase(bookRepository);
export const updateLibraryBookStateUseCase = new UpdateLibraryBookStateUseCase(bookRepository);
export const updateLibraryBookMetadataUseCase = new UpdateLibraryBookMetadataUseCase(
	bookRepository,
	managedBookCoverService
);
export const getReadingActivityStatsUseCase = new GetReadingActivityStatsUseCase(
	bookRepository,
	bookProgressHistoryRepository
);
export const listShelvesUseCase = new ListShelvesUseCase(shelfRepository);
export const createShelfUseCase = new CreateShelfUseCase(shelfRepository);
export const updateShelfUseCase = new UpdateShelfUseCase(shelfRepository);
export const updateShelfRulesUseCase = new UpdateShelfRulesUseCase(shelfRepository);
export const reorderShelvesUseCase = new ReorderShelvesUseCase(shelfRepository);
export const deleteShelfUseCase = new DeleteShelfUseCase(shelfRepository);
export const setBookShelvesUseCase = new SetBookShelvesUseCase(bookRepository, shelfRepository);
