import { DavUploadServiceFactory } from '$lib/server/infrastructure/factories/DavUploadServiceFactory';
import { DownloadQueue } from '$lib/server/infrastructure/queue/downloadQueue';
import { QueueJobRepository } from '$lib/server/infrastructure/repositories/QueueJobRepository';
import { DownloadBookUseCase } from '$lib/server/application/use-cases/DownloadBookUseCase';
import { QueueDownloadUseCase } from '$lib/server/application/use-cases/QueueDownloadUseCase';
import { QueueSearchBookUseCase } from '$lib/server/application/use-cases/QueueSearchBookUseCase';
import { GetQueueStatusUseCase } from '$lib/server/application/use-cases/GetQueueStatusUseCase';
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
import { GetLibraryBookContentUseCase } from '$lib/server/application/use-cases/GetLibraryBookContentUseCase';
import { PutLibraryFileUseCase } from '$lib/server/application/use-cases/PutLibraryFileUseCase';
import { DeleteLibraryFileUseCase } from '$lib/server/application/use-cases/DeleteLibraryFileUseCase';
import { ListDavDirectoryUseCase } from '$lib/server/application/use-cases/ListDavDirectoryUseCase';
import { ExportDeviceLibraryBookUseCase } from '$lib/server/application/use-cases/ExportDeviceLibraryBookUseCase';
import {
	annotationIndexService,
	bookProgressHistoryRepository,
	bookRepository,
	deviceDownloadRepository,
	deviceProgressDownloadRepository,
	hardcoverProgressSyncJobRepository,
	hardcoverProgressSyncService,
	managedBookCoverService,
	sidecarWriteCoordinator,
	storage,
	zlibraryClient
} from './foundation';
import { externalBookMetadataService } from './providers';
import { downloadSearchBookUseCase } from './search';

export const downloadBookUseCase = new DownloadBookUseCase(
	zlibraryClient,
	bookRepository,
	storage,
	() => DavUploadServiceFactory.createS3(),
	managedBookCoverService,
	undefined,
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
	deviceProgressDownloadRepository,
	hardcoverProgressSyncService,
	annotationIndexService,
	sidecarWriteCoordinator
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
export const getLibraryBookContentUseCase = new GetLibraryBookContentUseCase(
	bookRepository,
	storage
);
export const putLibraryFileUseCase = new PutLibraryFileUseCase(
	storage,
	bookRepository,
	managedBookCoverService,
	undefined,
	externalBookMetadataService
);
export const downloadQueue = new DownloadQueue(
	new QueueJobRepository(),
	downloadBookUseCase,
	downloadSearchBookUseCase,
	putLibraryFileUseCase
);
export const queueDownloadUseCase = new QueueDownloadUseCase(downloadQueue);
export const queueSearchBookUseCase = new QueueSearchBookUseCase(downloadQueue);
export const getQueueStatusUseCase = new GetQueueStatusUseCase(
	downloadQueue,
	hardcoverProgressSyncJobRepository
);
export const exportDeviceLibraryBookUseCase = new ExportDeviceLibraryBookUseCase(
	bookRepository,
	deviceDownloadRepository,
	deviceProgressDownloadRepository,
	storage,
	putLibraryFileUseCase,
	hardcoverProgressSyncService,
	annotationIndexService,
	sidecarWriteCoordinator
);
export const deleteLibraryFileUseCase = new DeleteLibraryFileUseCase(storage);
export const listDavDirectoryUseCase = new ListDavDirectoryUseCase(storage);
