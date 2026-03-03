import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { DeviceDownloadRepositoryPort } from '$lib/server/application/ports/DeviceDownloadRepositoryPort';
import type { ShelfRepositoryPort } from '$lib/server/application/ports/ShelfRepositoryPort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface GetLibraryBookDetailInput {
	bookId: number;
}

export interface LibraryBookDetail {
	success: true;
	bookId: number;
	title: string;
	author: string | null;
	publisher: string | null;
	series: string | null;
	volume: string | null;
	edition: string | null;
	identifier: string | null;
	pages: number | null;
	description: string | null;
	googleBooksId: string | null;
	openLibraryKey: string | null;
	amazonAsin: string | null;
	externalRating: number | null;
	externalRatingCount: number | null;
	progressPercent: number | null;
	rating: number | null;
	isRead: boolean;
	readAt: string | null;
	isArchived: boolean;
	archivedAt: string | null;
	excludeFromNewBooks: boolean;
	downloadedDevices: string[];
	shelfIds: number[];
}

export class GetLibraryBookDetailUseCase {
	constructor(
		private readonly bookRepository: BookRepositoryPort,
		private readonly deviceDownloadRepository: DeviceDownloadRepositoryPort,
		private readonly shelfRepository: ShelfRepositoryPort
	) {}

	async execute(input: GetLibraryBookDetailInput): Promise<ApiResult<LibraryBookDetail>> {
		const book = await this.bookRepository.getById(input.bookId);
		if (!book) {
			return apiError('Book not found', 404);
		}

		const downloads = await this.deviceDownloadRepository.getByBookId(input.bookId);
		const downloadedDevices = [...new Set(downloads.map((download) => download.deviceId))].sort();
		const shelfIds = await this.shelfRepository.getBookShelfIds(input.bookId);

		const progressPercent =
			typeof book.progress_percent === 'number'
				? Math.max(0, Math.min(100, book.progress_percent * 100))
				: null;

		return apiOk({
			success: true,
			bookId: input.bookId,
			title: book.title,
			author: book.author,
			publisher: book.publisher,
			series: book.series,
			volume: book.volume,
			edition: book.edition,
			identifier: book.identifier,
			pages: book.pages,
			description: book.description,
			googleBooksId: book.google_books_id,
			openLibraryKey: book.open_library_key,
			amazonAsin: book.amazon_asin,
			externalRating: book.external_rating,
			externalRatingCount: book.external_rating_count,
			progressPercent,
			rating: book.rating,
			isRead: Boolean(book.read_at),
			readAt: book.read_at,
			isArchived: Boolean(book.archived_at),
			archivedAt: book.archived_at,
			excludeFromNewBooks: book.exclude_from_new_books || Boolean(book.archived_at),
			downloadedDevices,
			shelfIds
		});
	}
}
