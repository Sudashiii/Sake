import type {
	MetadataCandidate,
	MetadataCoverCandidate
} from '$lib/server/application/ports/MetadataProviderPort';
import {
	isApplyMetadataFieldSelection,
	type ApplyMetadataFieldSelection,
	type ApplyMetadataCandidateInput
} from '$lib/server/application/use-cases/ApplyMetadataCandidateUseCase';
import { METADATA_PROVIDER_IDS, type MetadataProviderId } from '$lib/types/Metadata/Provider';

type ApplyMetadataCandidateBody = Omit<ApplyMetadataCandidateInput, 'bookId'>;

const DESCRIPTION_FORMATS = new Set(['text', 'html', 'markdown']);
const METADATA_PROVIDER_ID_SET = new Set<string>(METADATA_PROVIDER_IDS);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseString(value: unknown, label: string): string {
	if (typeof value !== 'string') {
		throw new Error(`${label} must be a string`);
	}
	return value;
}

function parseNonEmptyString(value: unknown, label: string): string {
	const parsed = parseString(value, label).trim();
	if (parsed.length === 0) {
		throw new Error(`${label} cannot be empty`);
	}
	return parsed;
}

function parseNullableString(value: unknown, label: string): string | null {
	if (value === null || value === undefined) {
		return null;
	}
	if (typeof value !== 'string') {
		throw new Error(`${label} must be a string or null`);
	}
	return value;
}

function parseNullableNumber(value: unknown, label: string): number | null {
	if (value === null || value === undefined) {
		return null;
	}
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Error(`${label} must be a finite number or null`);
	}
	return value;
}

function parseStringArray(value: unknown, label: string): string[] {
	if (!Array.isArray(value)) {
		throw new Error(`${label} must be an array`);
	}
	return value.map((item, index) => parseString(item, `${label}[${index}]`));
}

function parseMetadataProviderId(value: unknown): MetadataProviderId {
	const providerId = parseNonEmptyString(value, 'candidate.providerId');
	if (!METADATA_PROVIDER_ID_SET.has(providerId)) {
		throw new Error(`candidate.providerId is not supported: ${providerId}`);
	}
	return providerId as MetadataProviderId;
}

function parseIdentifiers(value: unknown): MetadataCandidate['identifiers'] {
	if (!isRecord(value)) {
		throw new Error('candidate.identifiers must be an object');
	}
	return {
		isbn10: parseNullableString(value.isbn10, 'candidate.identifiers.isbn10'),
		isbn13: parseNullableString(value.isbn13, 'candidate.identifiers.isbn13'),
		asin: parseNullableString(value.asin, 'candidate.identifiers.asin'),
		googleBooksId: parseNullableString(
			value.googleBooksId,
			'candidate.identifiers.googleBooksId'
		),
		openLibraryKey: parseNullableString(
			value.openLibraryKey,
			'candidate.identifiers.openLibraryKey'
		),
		hardcoverId: parseNullableString(value.hardcoverId, 'candidate.identifiers.hardcoverId')
	};
}

function parsePublishedDate(value: unknown): MetadataCandidate['publishedDate'] {
	if (!isRecord(value)) {
		throw new Error('candidate.publishedDate must be an object');
	}
	return {
		year: parseNullableNumber(value.year, 'candidate.publishedDate.year'),
		month: parseNullableNumber(value.month, 'candidate.publishedDate.month'),
		day: parseNullableNumber(value.day, 'candidate.publishedDate.day')
	};
}

function parseCoverCandidate(value: unknown, label: string): MetadataCoverCandidate {
	if (!isRecord(value)) {
		throw new Error(`${label} must be an object`);
	}
	const cover: MetadataCoverCandidate = {
		url: parseNonEmptyString(value.url, `${label}.url`),
		source: parseNonEmptyString(value.source, `${label}.source`)
	};

	if (value.width !== undefined && value.width !== null) {
		cover.width = parseNullableNumber(value.width, `${label}.width`) ?? undefined;
	}
	if (value.height !== undefined && value.height !== null) {
		cover.height = parseNullableNumber(value.height, `${label}.height`) ?? undefined;
	}

	return cover;
}

function parseCovers(value: unknown): MetadataCoverCandidate[] {
	if (!Array.isArray(value)) {
		throw new Error('candidate.covers must be an array');
	}
	return value.map((cover, index) => parseCoverCandidate(cover, `candidate.covers[${index}]`));
}

function parseRating(value: unknown): MetadataCandidate['rating'] {
	if (!isRecord(value)) {
		throw new Error('candidate.rating must be an object');
	}
	return {
		average: parseNullableNumber(value.average, 'candidate.rating.average'),
		count: parseNullableNumber(value.count, 'candidate.rating.count')
	};
}

function parseDescriptionFormat(value: unknown): MetadataCandidate['descriptionFormat'] {
	const format = parseString(value, 'candidate.descriptionFormat');
	if (!DESCRIPTION_FORMATS.has(format)) {
		throw new Error('candidate.descriptionFormat must be text, html, or markdown');
	}
	return format as MetadataCandidate['descriptionFormat'];
}

function parseCandidate(value: unknown): MetadataCandidate {
	if (!isRecord(value)) {
		throw new Error('candidate must be an object');
	}

	return {
		providerId: parseMetadataProviderId(value.providerId),
		providerScore: parseNullableNumber(value.providerScore, 'candidate.providerScore') ?? 0,
		identifiers: parseIdentifiers(value.identifiers),
		title: parseNonEmptyString(value.title, 'candidate.title'),
		subtitle: parseNullableString(value.subtitle, 'candidate.subtitle'),
		authors: parseStringArray(value.authors, 'candidate.authors'),
		description: parseNullableString(value.description, 'candidate.description'),
		descriptionFormat: parseDescriptionFormat(value.descriptionFormat),
		subjects: parseStringArray(value.subjects, 'candidate.subjects'),
		series: parseNullableString(value.series, 'candidate.series'),
		seriesIndex: parseNullableNumber(value.seriesIndex, 'candidate.seriesIndex'),
		publisher: parseNullableString(value.publisher, 'candidate.publisher'),
		publishedDate: parsePublishedDate(value.publishedDate),
		language: parseNullableString(value.language, 'candidate.language'),
		pageCount: parseNullableNumber(value.pageCount, 'candidate.pageCount'),
		covers: parseCovers(value.covers),
		rating: parseRating(value.rating),
		sourceUrl: parseNullableString(value.sourceUrl, 'candidate.sourceUrl')
	};
}

function parseFieldSelections(value: unknown): ApplyMetadataFieldSelection[] {
	if (value === undefined || value === null) {
		return [];
	}
	if (!Array.isArray(value)) {
		throw new Error('fieldSelections must be an array');
	}

	const selections: ApplyMetadataFieldSelection[] = [];
	for (const [index, rawField] of value.entries()) {
		const field = parseNonEmptyString(rawField, `fieldSelections[${index}]`);
		if (!isApplyMetadataFieldSelection(field)) {
			throw new Error(`Unknown field selection: ${field}`);
		}
		if (!selections.includes(field)) {
			selections.push(field);
		}
	}
	return selections;
}

function parseCoverChoice(value: unknown): MetadataCoverCandidate | null {
	if (value === undefined || value === null) {
		return null;
	}
	return parseCoverCandidate(value, 'coverChoice');
}

export function parseApplyMetadataCandidateBody(body: unknown): ApplyMetadataCandidateBody {
	if (!isRecord(body)) {
		throw new Error('Body must be a JSON object');
	}

	const candidate = parseCandidate(body.candidate);
	const fieldSelections = parseFieldSelections(body.fieldSelections ?? body.fields);
	const coverChoice = parseCoverChoice(body.coverChoice ?? body.cover);

	if (fieldSelections.length === 0 && coverChoice === null) {
		throw new Error('At least one field selection or cover choice is required');
	}

	return {
		candidate,
		fieldSelections,
		coverChoice
	};
}
