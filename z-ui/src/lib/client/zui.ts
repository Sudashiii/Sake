import type { Result } from '$lib/types/Result';
import type { ApiError } from '$lib/types/ApiError';
import type { ZLoginRequest } from '$lib/types/ZLibrary/Requests/ZLoginRequest';
import type { ZSearchBookRequest } from '$lib/types/ZLibrary/Requests/ZSearchBookRequest';
import type { ZTokenLoginRequest } from '$lib/types/ZLibrary/Requests/ZTokenLoginRequest';
import type { ZSearchBookResponse } from '$lib/types/ZLibrary/Responses/ZSearchBookResponse';
import type { ZLoginResponse } from '$lib/types/ZLibrary/Responses/ZLoginResponse';
import type { ZBook } from '$lib/types/ZLibrary/ZBook';
import { authCheck } from './routes/authCheck';
import { downloadBook } from './routes/downloadBook';
import { passwordLogin } from './routes/passwordLogin';
import { searchBook } from './routes/searchBook';
import {
	lookupSearchBookMetadata,
	type LookupSearchBookMetadataRequest,
	type LookupSearchBookMetadataResponse
} from './routes/lookupSearchBookMetadata';
import { tokenLogin } from './routes/tokenLogin';
import { getLibrary, type LibraryResponse } from './routes/getLibrary';
import { getLibraryTrash, type LibraryTrashResponse } from './routes/getLibraryTrash';
import { getLibraryBookDetail } from './routes/getLibraryBookDetail';
import {
	refetchLibraryBookMetadata,
	type RefetchLibraryBookMetadataResponse
} from './routes/refetchLibraryBookMetadata';
import { removeLibraryBookDeviceDownload } from './routes/removeLibraryBookDeviceDownload';
import { resetDownloadStatus } from './routes/resetDownloadStatus';
import { moveLibraryBookToTrash } from './routes/moveLibraryBookToTrash';
import { restoreLibraryBook } from './routes/restoreLibraryBook';
import { deleteTrashedLibraryBook } from './routes/deleteTrashedLibraryBook';
import { queueToLibrary, type QueueResponse } from './routes/queueToLibrary';
import type { LibraryBookDetail } from '$lib/types/Library/BookDetail';
import { downloadLibraryBookFile } from './routes/downloadLibraryBookFile';
import {
	updateLibraryBookRating,
	type UpdateLibraryBookRatingResponse
} from './routes/updateLibraryBookRating';
import { getLibraryRatings, type LibraryRatingsResponse } from './routes/getLibraryRatings';
import {
	updateLibraryBookState,
	type UpdateLibraryBookStateResponse
} from './routes/updateLibraryBookState';
import { uploadLibraryBookFile } from './routes/uploadLibraryBookFile';
import { updateLibraryBookMetadata, type UpdateLibraryBookMetadataRequest } from './routes/updateLibraryBookMetadata';
import { getQueueStatus, type QueueStatusResponse } from './routes/getQueueStatus';
import { getLibraryBookProgressHistory } from './routes/getLibraryBookProgressHistory';
import type { BookProgressHistoryResponse } from '$lib/types/Library/BookProgressHistory';
import { getReadingActivityStats } from './routes/getReadingActivityStats';
import type { ReadingActivityStats } from '$lib/types/Stats/ReadingActivityStats';
import { getLibraryShelves, type GetLibraryShelvesResponse } from './routes/getLibraryShelves';
import { createLibraryShelf, type CreateLibraryShelfResponse } from './routes/createLibraryShelf';
import { updateLibraryShelf, type UpdateLibraryShelfResponse } from './routes/updateLibraryShelf';
import { deleteLibraryShelf, type DeleteLibraryShelfResponse } from './routes/deleteLibraryShelf';
import { setLibraryBookShelves, type SetLibraryBookShelvesResponse } from './routes/setLibraryBookShelves';
import {
	updateLibraryShelfRules,
	type UpdateLibraryShelfRulesResponse
} from './routes/updateLibraryShelfRules';
import type { RuleGroup } from '$lib/types/Library/ShelfRule';

/**
 * Facade for all Z-Library UI client operations.
 * All methods return Result types for type-safe error handling.
 */
export const ZUI = {
	searchBook: (request: ZSearchBookRequest): Promise<Result<ZSearchBookResponse, ApiError>> =>
		searchBook(request),

	lookupSearchBookMetadata: (
		request: LookupSearchBookMetadataRequest
	): Promise<Result<LookupSearchBookMetadataResponse, ApiError>> =>
		lookupSearchBookMetadata(request),

	passwordLogin: (request: ZLoginRequest): Promise<Result<ZLoginResponse, ApiError>> =>
		passwordLogin(request),

	tokenLogin: (request: ZTokenLoginRequest): Promise<Result<void, ApiError>> =>
		tokenLogin(request),

	authCheck: (): Promise<Result<void, ApiError>> => authCheck(),

	downloadBook: (book: ZBook, options?: { downloadToDevice?: boolean }): Promise<Result<void, ApiError>> =>
		downloadBook(book, options),

	queueToLibrary: (book: ZBook): Promise<Result<QueueResponse, ApiError>> =>
		queueToLibrary(book),

	getQueueStatus: (): Promise<Result<QueueStatusResponse, ApiError>> =>
		getQueueStatus(),

	getLibrary: (): Promise<Result<LibraryResponse, ApiError>> => getLibrary(),

	getLibraryTrash: (): Promise<Result<LibraryTrashResponse, ApiError>> => getLibraryTrash(),

	getLibraryBookDetail: (bookId: number): Promise<Result<LibraryBookDetail, ApiError>> =>
		getLibraryBookDetail(bookId),

	getLibraryBookProgressHistory: (bookId: number): Promise<Result<BookProgressHistoryResponse, ApiError>> =>
		getLibraryBookProgressHistory(bookId),

	getReadingActivityStats: (days?: number): Promise<Result<ReadingActivityStats, ApiError>> =>
		getReadingActivityStats(days),

	refetchLibraryBookMetadata: (
		bookId: number
	): Promise<Result<RefetchLibraryBookMetadataResponse, ApiError>> =>
		refetchLibraryBookMetadata(bookId),

	removeLibraryBookDeviceDownload: (bookId: number, deviceId: string): Promise<Result<void, ApiError>> =>
		removeLibraryBookDeviceDownload(bookId, deviceId),

	resetDownloadStatus: (bookId: number): Promise<Result<void, ApiError>> =>
		resetDownloadStatus(bookId),

	moveLibraryBookToTrash: (bookId: number) => moveLibraryBookToTrash(bookId),

	restoreLibraryBook: (bookId: number) => restoreLibraryBook(bookId),

	deleteTrashedLibraryBook: (bookId: number) => deleteTrashedLibraryBook(bookId),

	downloadLibraryBookFile: (storageKey: string, fileName: string) =>
		downloadLibraryBookFile(storageKey, fileName),

	uploadLibraryBookFile: (file: File): Promise<Result<void, ApiError>> =>
		uploadLibraryBookFile(file),

	updateLibraryBookRating: (
		bookId: number,
		rating: number | null
	): Promise<Result<UpdateLibraryBookRatingResponse, ApiError>> =>
		updateLibraryBookRating(bookId, rating),

	getLibraryRatings: (): Promise<Result<LibraryRatingsResponse, ApiError>> => getLibraryRatings(),

	updateLibraryBookState: (
		bookId: number,
		request: { isRead?: boolean; excludeFromNewBooks?: boolean; archived?: boolean }
	): Promise<Result<UpdateLibraryBookStateResponse, ApiError>> =>
		updateLibraryBookState(bookId, request),

	updateLibraryBookMetadata: (
		bookId: number,
		request: UpdateLibraryBookMetadataRequest
	) => updateLibraryBookMetadata(bookId, request),

	getLibraryShelves: (): Promise<Result<GetLibraryShelvesResponse, ApiError>> => getLibraryShelves(),

	createLibraryShelf: (
		request: { name: string; icon?: string }
	): Promise<Result<CreateLibraryShelfResponse, ApiError>> => createLibraryShelf(request),

	updateLibraryShelf: (
		shelfId: number,
		request: { name: string; icon?: string }
	): Promise<Result<UpdateLibraryShelfResponse, ApiError>> => updateLibraryShelf(shelfId, request),

	updateLibraryShelfRules: (
		shelfId: number,
		ruleGroup: RuleGroup
	): Promise<Result<UpdateLibraryShelfRulesResponse, ApiError>> =>
		updateLibraryShelfRules(shelfId, ruleGroup),

	deleteLibraryShelf: (
		shelfId: number
	): Promise<Result<DeleteLibraryShelfResponse, ApiError>> => deleteLibraryShelf(shelfId),

	setLibraryBookShelves: (
		bookId: number,
		shelfIds: number[]
	): Promise<Result<SetLibraryBookShelvesResponse, ApiError>> => setLibraryBookShelves(bookId, shelfIds)
} as const;

export type ZUIClient = typeof ZUI;
