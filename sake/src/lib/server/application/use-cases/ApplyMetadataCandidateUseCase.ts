import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type {
	MetadataCandidate,
	MetadataCoverCandidate
} from '$lib/server/application/ports/MetadataProviderPort';
import type { ManagedBookCoverService } from '$lib/server/application/services/ManagedBookCoverService';
import type { Book, UpdateBookMetadataInput } from '$lib/server/domain/entities/Book';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import { validatePublicationDateParts } from '$lib/utils/publicationDate';

export const APPLY_METADATA_FIELD_SELECTIONS = [
	'title',
	'author',
	'publisher',
	'series',
	'seriesIndex',
	'identifier',
	'pages',
	'description',
	'language',
	'publishedDate',
	'year',
	'month',
	'day',
	'googleBooksId',
	'openLibraryKey',
	'amazonAsin',
	'externalRating',
	'externalRatingCount'
] as const;

export type ApplyMetadataFieldSelection = (typeof APPLY_METADATA_FIELD_SELECTIONS)[number];

export interface ApplyMetadataCandidateInput {
	bookId: number;
	candidate: MetadataCandidate;
	fieldSelections: ApplyMetadataFieldSelection[];
	coverChoice?: MetadataCoverCandidate | null;
}

interface AppliedMetadataBook {
	id: number;
	zLibId: string | null;
	title: string;
	author: string | null;
	publisher: string | null;
	series: string | null;
	volume: string | null;
	seriesIndex: number | null;
	edition: string | null;
	identifier: string | null;
	pages: number | null;
	description: string | null;
	googleBooksId: string | null;
	openLibraryKey: string | null;
	amazonAsin: string | null;
	externalRating: number | null;
	externalRatingCount: number | null;
	cover: string | null;
	extension: string | null;
	filesize: number | null;
	language: string | null;
	year: number | null;
	month: number | null;
	day: number | null;
	createdAt: string | null;
}

export interface ApplyMetadataCandidateResult {
	success: true;
	book: AppliedMetadataBook;
}

type MetadataPatch = Partial<{
	title: string;
	author: string | null;
	publisher: string | null;
	series: string | null;
	seriesIndex: number | null;
	identifier: string | null;
	pages: number | null;
	description: string | null;
	language: string | null;
	year: number | null;
	month: number | null;
	day: number | null;
	googleBooksId: string | null;
	openLibraryKey: string | null;
	amazonAsin: string | null;
	externalRating: number | null;
	externalRatingCount: number | null;
	cover: string | null;
}>;

const APPLY_METADATA_FIELD_SELECTION_SET = new Set<string>(APPLY_METADATA_FIELD_SELECTIONS);

export function isApplyMetadataFieldSelection(value: string): value is ApplyMetadataFieldSelection {
	return APPLY_METADATA_FIELD_SELECTION_SET.has(value);
}

function trimToNull(value: string | null | undefined): string | null {
	if (typeof value !== 'string') {
		return null;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function finiteNumberOrNull(value: number | null | undefined): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function authorsToAuthorField(authors: string[]): string | null {
	const joined = authors.map((author) => author.trim()).filter(Boolean).join(', ');
	return joined.length > 0 ? joined : null;
}

function preferredIdentifier(candidate: MetadataCandidate): string | null {
	return trimToNull(candidate.identifiers.isbn13) ?? trimToNull(candidate.identifiers.isbn10);
}

function buildPatch(
	candidate: MetadataCandidate,
	fieldSelections: ApplyMetadataFieldSelection[]
): MetadataPatch {
	const patch: MetadataPatch = {};

	for (const field of fieldSelections) {
		switch (field) {
			case 'title':
				patch.title = candidate.title.trim();
				break;
			case 'author':
				patch.author = authorsToAuthorField(candidate.authors);
				break;
			case 'publisher':
				patch.publisher = trimToNull(candidate.publisher);
				break;
			case 'series':
				patch.series = trimToNull(candidate.series);
				break;
			case 'seriesIndex':
				patch.seriesIndex = finiteNumberOrNull(candidate.seriesIndex);
				break;
			case 'identifier':
				patch.identifier = preferredIdentifier(candidate);
				break;
			case 'pages':
				patch.pages = finiteNumberOrNull(candidate.pageCount);
				break;
			case 'description':
				patch.description = trimToNull(candidate.description);
				break;
			case 'language':
				patch.language = trimToNull(candidate.language);
				break;
			case 'publishedDate':
				patch.year = finiteNumberOrNull(candidate.publishedDate.year);
				patch.month = finiteNumberOrNull(candidate.publishedDate.month);
				patch.day = finiteNumberOrNull(candidate.publishedDate.day);
				break;
			case 'year':
				patch.year = finiteNumberOrNull(candidate.publishedDate.year);
				break;
			case 'month':
				patch.month = finiteNumberOrNull(candidate.publishedDate.month);
				break;
			case 'day':
				patch.day = finiteNumberOrNull(candidate.publishedDate.day);
				break;
			case 'googleBooksId':
				patch.googleBooksId = trimToNull(candidate.identifiers.googleBooksId);
				break;
			case 'openLibraryKey':
				patch.openLibraryKey = trimToNull(candidate.identifiers.openLibraryKey);
				break;
			case 'amazonAsin':
				patch.amazonAsin = trimToNull(candidate.identifiers.asin);
				break;
			case 'externalRating':
				patch.externalRating = finiteNumberOrNull(candidate.rating.average);
				break;
			case 'externalRatingCount':
				patch.externalRatingCount = finiteNumberOrNull(candidate.rating.count);
				break;
		}
	}

	return patch;
}

function normalizePublicationDatePatch(
	existing: Book,
	patch: MetadataPatch
): { year: number | null; month: number | null; day: number | null } {
	const year = patch.year === undefined ? existing.year : patch.year;
	const month = patch.month === undefined ? existing.month : patch.month;
	const day = patch.day === undefined ? existing.day : patch.day;

	if (year === null) {
		return { year: null, month: null, day: null };
	}
	if (month === null) {
		return { year, month: null, day: null };
	}
	return { year, month, day };
}

function buildUpdateMetadataInput(existing: Book, patch: MetadataPatch): UpdateBookMetadataInput {
	const nextTitle = patch.title === undefined ? existing.title : patch.title;
	const nextPublicationDate = normalizePublicationDatePatch(existing, patch);

	return {
		zLibId: existing.zLibId,
		title: nextTitle,
		author: patch.author === undefined ? existing.author : patch.author,
		publisher: patch.publisher === undefined ? existing.publisher : patch.publisher,
		series: patch.series === undefined ? existing.series : patch.series,
		volume: existing.volume,
		series_index: patch.seriesIndex === undefined ? existing.series_index : patch.seriesIndex,
		edition: existing.edition,
		identifier: patch.identifier === undefined ? existing.identifier : patch.identifier,
		pages: patch.pages === undefined ? existing.pages : patch.pages,
		description: patch.description === undefined ? existing.description : patch.description,
		google_books_id:
			patch.googleBooksId === undefined ? existing.google_books_id : patch.googleBooksId,
		open_library_key:
			patch.openLibraryKey === undefined ? existing.open_library_key : patch.openLibraryKey,
		amazon_asin: patch.amazonAsin === undefined ? existing.amazon_asin : patch.amazonAsin,
		external_rating:
			patch.externalRating === undefined ? existing.external_rating : patch.externalRating,
		external_rating_count:
			patch.externalRatingCount === undefined
				? existing.external_rating_count
				: patch.externalRatingCount,
		cover: patch.cover === undefined ? existing.cover : patch.cover,
		extension: existing.extension,
		filesize: existing.filesize,
		language: patch.language === undefined ? existing.language : patch.language,
		year: nextPublicationDate.year,
		month: nextPublicationDate.month,
		day: nextPublicationDate.day,
		createdAt: existing.createdAt
	};
}

function toAppliedMetadataBook(book: Book): AppliedMetadataBook {
	return {
		id: book.id,
		zLibId: book.zLibId,
		title: book.title,
		author: book.author,
		publisher: book.publisher,
		series: book.series,
		volume: book.volume,
		seriesIndex: book.series_index,
		edition: book.edition,
		identifier: book.identifier,
		pages: book.pages,
		description: book.description,
		googleBooksId: book.google_books_id,
		openLibraryKey: book.open_library_key,
		amazonAsin: book.amazon_asin,
		externalRating: book.external_rating,
		externalRatingCount: book.external_rating_count,
		cover: book.cover,
		extension: book.extension,
		filesize: book.filesize,
		language: book.language,
		year: book.year,
		month: book.month,
		day: book.day,
		createdAt: book.createdAt
	};
}

export class ApplyMetadataCandidateUseCase {
	constructor(
		private readonly bookRepository: BookRepositoryPort,
		private readonly managedBookCoverService: Pick<ManagedBookCoverService, 'storeFromExternalUrl'>
	) {}

	async execute(
		input: ApplyMetadataCandidateInput
	): Promise<ApiResult<ApplyMetadataCandidateResult>> {
		if (input.fieldSelections.length === 0 && !input.coverChoice) {
			return apiError('At least one field selection or cover choice is required', 400);
		}

		const existing = await this.bookRepository.getById(input.bookId);
		if (!existing) {
			return apiError('Book not found', 404);
		}

		const patch = buildPatch(input.candidate, [...new Set(input.fieldSelections)]);

		if (input.coverChoice) {
			const importedCover = await this.managedBookCoverService.storeFromExternalUrl({
				bookStorageKey: existing.s3_storage_key,
				coverUrl: input.coverChoice.url
			});
			if (!importedCover.managedUrl) {
				return apiError('Failed to import cover image', 502);
			}
			patch.cover = importedCover.managedUrl;
		}

		const metadata = buildUpdateMetadataInput(existing, patch);
		if (metadata.title.trim().length === 0) {
			return apiError('title cannot be empty', 400);
		}

		const publicationDateError = validatePublicationDateParts({
			year: metadata.year,
			month: metadata.month,
			day: metadata.day
		});
		if (publicationDateError) {
			return apiError(publicationDateError, 400);
		}

		const updated = await this.bookRepository.updateMetadata(input.bookId, metadata);

		return apiOk({
			success: true,
			book: toAppliedMetadataBook(updated)
		});
	}
}
