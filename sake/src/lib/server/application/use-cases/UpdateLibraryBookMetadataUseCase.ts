import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import {
	ManagedBookCoverService,
	isManagedBookCoverUrl
} from '$lib/server/application/services/ManagedBookCoverService';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import { validatePublicationDateParts } from '$lib/utils/publicationDate';

interface UpdateLibraryBookMetadataInput {
	bookId: number;
		metadata: {
			title?: string;
		author?: string | null;
		publisher?: string | null;
		series?: string | null;
		volume?: string | null;
		seriesIndex?: number | null;
		edition?: string | null;
		identifier?: string | null;
		pages?: number | null;
		description?: string | null;
		cover?: string | null;
		language?: string | null;
		year?: number | null;
		month?: number | null;
		day?: number | null;
		externalRating?: number | null;
			externalRatingCount?: number | null;
			googleBooksId?: string | null;
			openLibraryKey?: string | null;
			amazonAsin?: string | null;
			createdAt?: string | null;
		};
}

interface UpdateLibraryBookMetadataResult {
	success: true;
	bookId: number;
}

export class UpdateLibraryBookMetadataUseCase {
	constructor(
		private readonly bookRepository: BookRepositoryPort,
		private readonly managedBookCoverService: Pick<ManagedBookCoverService, 'deleteForBookStorageKey'>
	) {}

	async execute(input: UpdateLibraryBookMetadataInput): Promise<ApiResult<UpdateLibraryBookMetadataResult>> {
		const existing = await this.bookRepository.getById(input.bookId);
		if (!existing) {
			return apiError('Book not found', 404);
		}

		const nextTitle = input.metadata.title?.trim() ?? existing.title;
		if (!nextTitle) {
			return apiError('title cannot be empty', 400);
		}

		const nextCover = input.metadata.cover === undefined ? existing.cover : input.metadata.cover;
		const shouldDeleteManagedCover =
			isManagedBookCoverUrl(existing.cover) && !isManagedBookCoverUrl(nextCover);
		const nextPublicationDate = {
			year: input.metadata.year === undefined ? existing.year : input.metadata.year,
			month: input.metadata.month === undefined ? existing.month : input.metadata.month,
			day: input.metadata.day === undefined ? existing.day : input.metadata.day
		};
		const publicationDateError = validatePublicationDateParts(nextPublicationDate);
		if (publicationDateError) {
			return apiError(publicationDateError, 400);
		}

		await this.bookRepository.updateMetadata(input.bookId, {
			zLibId: existing.zLibId,
			title: nextTitle,
			author: input.metadata.author === undefined ? existing.author : input.metadata.author,
			publisher:
				input.metadata.publisher === undefined ? existing.publisher : input.metadata.publisher,
			series: input.metadata.series === undefined ? existing.series : input.metadata.series,
			volume: input.metadata.volume === undefined ? existing.volume : input.metadata.volume,
			series_index:
				input.metadata.seriesIndex === undefined
					? existing.series_index
					: input.metadata.seriesIndex,
			edition: input.metadata.edition === undefined ? existing.edition : input.metadata.edition,
			identifier:
				input.metadata.identifier === undefined ? existing.identifier : input.metadata.identifier,
			pages: input.metadata.pages === undefined ? existing.pages : input.metadata.pages,
			description:
				input.metadata.description === undefined
					? existing.description
					: input.metadata.description,
			google_books_id:
				input.metadata.googleBooksId === undefined
					? existing.google_books_id
					: input.metadata.googleBooksId,
			open_library_key:
				input.metadata.openLibraryKey === undefined
					? existing.open_library_key
					: input.metadata.openLibraryKey,
			amazon_asin:
				input.metadata.amazonAsin === undefined
					? existing.amazon_asin
					: input.metadata.amazonAsin,
			external_rating:
				input.metadata.externalRating === undefined
					? existing.external_rating
					: input.metadata.externalRating,
			external_rating_count:
				input.metadata.externalRatingCount === undefined
					? existing.external_rating_count
					: input.metadata.externalRatingCount,
			cover: nextCover,
			extension: existing.extension,
			filesize: existing.filesize,
			language: input.metadata.language === undefined ? existing.language : input.metadata.language,
			year: nextPublicationDate.year,
			month: nextPublicationDate.month,
			day: nextPublicationDate.day,
			createdAt: input.metadata.createdAt === undefined ? existing.createdAt : input.metadata.createdAt
		});

		if (shouldDeleteManagedCover) {
			await this.managedBookCoverService.deleteForBookStorageKey(existing.s3_storage_key);
		}

		return apiOk({ success: true, bookId: input.bookId });
	}
}
