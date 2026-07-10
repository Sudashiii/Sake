import { ListLibraryUseCase } from '$lib/server/application/use-cases/ListLibraryUseCase';
import { GetLibraryBookDetailUseCase } from '$lib/server/application/use-cases/GetLibraryBookDetailUseCase';
import { RefetchLibraryBookMetadataUseCase } from '$lib/server/application/use-cases/RefetchLibraryBookMetadataUseCase';
import { MoveLibraryBookToTrashUseCase } from '$lib/server/application/use-cases/MoveLibraryBookToTrashUseCase';
import { ListLibraryTrashUseCase } from '$lib/server/application/use-cases/ListLibraryTrashUseCase';
import { RestoreLibraryBookUseCase } from '$lib/server/application/use-cases/RestoreLibraryBookUseCase';
import { DeleteTrashedLibraryBookUseCase } from '$lib/server/application/use-cases/DeleteTrashedLibraryBookUseCase';
import { PurgeExpiredTrashUseCase } from '$lib/server/application/use-cases/PurgeExpiredTrashUseCase';
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
import { SearchMetadataCandidatesUseCase } from '$lib/server/application/use-cases/SearchMetadataCandidatesUseCase';
import { GetLibraryCoverUseCase } from '$lib/server/application/use-cases/GetLibraryCoverUseCase';
import { ImportLibraryBookCoverUseCase } from '$lib/server/application/use-cases/ImportLibraryBookCoverUseCase';
import { UploadLibraryBookCoverUseCase } from '$lib/server/application/use-cases/UploadLibraryBookCoverUseCase';
import {
	bookProgressHistoryRepository,
	bookRepository,
	deviceDownloadRepository,
	hardcoverProgressSyncService,
	managedBookCoverService,
	shelfRepository,
	storage
} from './foundation';
import { activatedMetadataAggregator, externalBookMetadataService } from './providers';

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
export const importLibraryBookCoverUseCase = new ImportLibraryBookCoverUseCase(
	bookRepository,
	managedBookCoverService
);
export const uploadLibraryBookCoverUseCase = new UploadLibraryBookCoverUseCase(
	bookRepository,
	managedBookCoverService
);
export const getLibraryCoverUseCase = new GetLibraryCoverUseCase(storage);
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
export const updateBookRatingUseCase = new UpdateBookRatingUseCase(bookRepository);
export const listLibraryRatingsUseCase = new ListLibraryRatingsUseCase(bookRepository);
export const updateLibraryBookStateUseCase = new UpdateLibraryBookStateUseCase(
	bookRepository,
	hardcoverProgressSyncService
);
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
export const searchMetadataCandidatesUseCase = new SearchMetadataCandidatesUseCase(
	activatedMetadataAggregator,
	bookRepository
);
