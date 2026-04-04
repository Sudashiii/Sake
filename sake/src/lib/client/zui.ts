import type { Result } from '$lib/types/Result';
import type { ApiError } from '$lib/types/ApiError';
import type { ZLoginRequest } from '$lib/types/ZLibrary/Requests/ZLoginRequest';
import type { ZTokenLoginRequest } from '$lib/types/ZLibrary/Requests/ZTokenLoginRequest';
import type { ZLoginResponse } from '$lib/types/ZLibrary/Responses/ZLoginResponse';
import { passwordLogin } from './routes/passwordLogin';
import { getAuthApiKeys } from './routes/getAuthApiKeys';
import { revokeAuthApiKey } from './routes/revokeAuthApiKey';
import { getDevices } from './routes/getDevices';
import { deleteDevice } from './routes/deleteDevice';
import { searchBooks } from './routes/searchBooks';
import {
	lookupSearchBookMetadata,
	type LookupSearchBookMetadataRequest,
	type LookupSearchBookMetadataResponse
} from './routes/lookupSearchBookMetadata';
import { downloadSearchBook } from './routes/downloadSearchBook';
import { queueSearchBookToLibrary, type QueueSearchBookResponse } from './routes/queueSearchBookToLibrary';
import { tokenLogin } from './routes/tokenLogin';
import { logoutZLibrary } from './routes/logoutZLibrary';
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
import {
	importLibraryBookCover,
	type ImportLibraryBookCoverResponse
} from './routes/importLibraryBookCover';
import { uploadLibraryBookCover } from './routes/uploadLibraryBookCover';
import { getQueueStatus, type QueueStatusResponse } from './routes/getQueueStatus';
import { getAppVersion } from './routes/getAppVersion';
import { getLibraryBookProgressHistory } from './routes/getLibraryBookProgressHistory';
import type { BookProgressHistoryResponse } from '$lib/types/Library/BookProgressHistory';
import { getReadingActivityStats } from './routes/getReadingActivityStats';
import type { ReadingActivityStats } from '$lib/types/Stats/ReadingActivityStats';
import { getLibraryShelves, type GetLibraryShelvesResponse } from './routes/getLibraryShelves';
import { createLibraryShelf, type CreateLibraryShelfResponse } from './routes/createLibraryShelf';
import { updateLibraryShelf, type UpdateLibraryShelfResponse } from './routes/updateLibraryShelf';
import {
	reorderLibraryShelves,
	type ReorderLibraryShelvesResponse
} from './routes/reorderLibraryShelves';
import { deleteLibraryShelf, type DeleteLibraryShelfResponse } from './routes/deleteLibraryShelf';
import { setLibraryBookShelves, type SetLibraryBookShelvesResponse } from './routes/setLibraryBookShelves';
import {
	updateLibraryShelfRules,
	type UpdateLibraryShelfRulesResponse
} from './routes/updateLibraryShelfRules';
import type { RuleGroup } from '$lib/types/Library/ShelfRule';
import type { SearchBooksRequest } from '$lib/types/Search/SearchBooksRequest';
import type { SearchBooksResponse } from '$lib/types/Search/SearchBooksResponse';
import type { SearchResultBook } from '$lib/types/Search/SearchResultBook';
import type { AppVersionResponse } from '$lib/types/App/AppVersion';
import type { AuthApiKeysResponse } from '$lib/types/Auth/ApiKey';
import type { DeleteDeviceResponse, DevicesResponse } from '$lib/types/Auth/Device';

/**
 * Facade for all Z-Library UI client operations.
 * All methods return Result types for type-safe error handling.
 */
export const ZUI = {
	searchBooks: (request: SearchBooksRequest): Promise<Result<SearchBooksResponse, ApiError>> =>
		searchBooks(request),

	lookupSearchBookMetadata: (
		request: LookupSearchBookMetadataRequest
	): Promise<Result<LookupSearchBookMetadataResponse, ApiError>> =>
		lookupSearchBookMetadata(request),

	passwordLogin: (request: ZLoginRequest): Promise<Result<ZLoginResponse, ApiError>> =>
		passwordLogin(request),

	tokenLogin: (request: ZTokenLoginRequest): Promise<Result<void, ApiError>> =>
		tokenLogin(request),

	logoutZLibrary: (): Promise<Result<void, ApiError>> => logoutZLibrary(),

	getAuthApiKeys: (): Promise<Result<AuthApiKeysResponse, ApiError>> => getAuthApiKeys(),

	getDevices: (): Promise<Result<DevicesResponse, ApiError>> => getDevices(),

	revokeAuthApiKey: (apiKeyId: number): Promise<Result<void, ApiError>> =>
		revokeAuthApiKey(apiKeyId),

	deleteDevice: (deviceId: string): Promise<Result<DeleteDeviceResponse, ApiError>> =>
		deleteDevice(deviceId),

	downloadSearchBook: (
		book: SearchResultBook,
		options?: { downloadToDevice?: boolean }
	): Promise<Result<void, ApiError>> => downloadSearchBook(book, options),

	queueSearchBookToLibrary: (
		book: SearchResultBook
	): Promise<Result<QueueSearchBookResponse, ApiError>> => queueSearchBookToLibrary(book),

	getAppVersion: (): Promise<Result<AppVersionResponse, ApiError>> => getAppVersion(),

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

	importLibraryBookCover: (
		bookId: number,
		coverUrl?: string | null
	): Promise<Result<ImportLibraryBookCoverResponse, ApiError>> =>
		importLibraryBookCover(bookId, coverUrl),

	uploadLibraryBookCover: (
		bookId: number,
		file: File
	): Promise<Result<ImportLibraryBookCoverResponse, ApiError>> =>
		uploadLibraryBookCover(bookId, file),

	getLibraryShelves: (): Promise<Result<GetLibraryShelvesResponse, ApiError>> => getLibraryShelves(),

	createLibraryShelf: (
		request: { name: string; icon?: string }
	): Promise<Result<CreateLibraryShelfResponse, ApiError>> => createLibraryShelf(request),

	updateLibraryShelf: (
		shelfId: number,
		request: { name: string; icon?: string }
	): Promise<Result<UpdateLibraryShelfResponse, ApiError>> => updateLibraryShelf(shelfId, request),

	reorderLibraryShelves: (
		shelfIds: number[]
	): Promise<Result<ReorderLibraryShelvesResponse, ApiError>> => reorderLibraryShelves(shelfIds),

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
