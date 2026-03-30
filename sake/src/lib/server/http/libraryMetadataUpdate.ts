import { validatePublicationDateParts } from '$lib/utils/publicationDate';

export type LibraryMetadataUpdateInput = {
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
};

const allowedKeys = new Set<keyof LibraryMetadataUpdateInput>([
	'title',
	'author',
	'publisher',
	'series',
	'volume',
	'seriesIndex',
	'edition',
	'identifier',
	'pages',
	'description',
	'cover',
	'language',
	'year',
	'month',
	'day',
	'externalRating',
	'externalRatingCount',
	'googleBooksId',
	'openLibraryKey',
	'amazonAsin'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseNullableString(
	body: Record<string, unknown>,
	key: keyof LibraryMetadataUpdateInput
): string | null | undefined {
	if (!(key in body)) {
		return undefined;
	}
	const value = body[key];
	if (value === null) {
		return null;
	}
	if (typeof value === 'string') {
		return value;
	}
	throw new Error(`${String(key)} must be a string or null`);
}

function parseOptionalString(
	body: Record<string, unknown>,
	key: keyof LibraryMetadataUpdateInput
): string | undefined {
	if (!(key in body)) {
		return undefined;
	}
	const value = body[key];
	if (typeof value === 'string') {
		return value;
	}
	throw new Error(`${String(key)} must be a string`);
}

function parseNullableNumber(
	body: Record<string, unknown>,
	key: keyof LibraryMetadataUpdateInput,
	options?: { min?: number }
): number | null | undefined {
	if (!(key in body)) {
		return undefined;
	}
	const value = body[key];
	if (value === null) {
		return null;
	}
	if (typeof value === 'number' && Number.isFinite(value)) {
		if (options?.min !== undefined && value < options.min) {
			throw new Error(`${String(key)} must be at least ${options.min}`);
		}
		return value;
	}
	throw new Error(`${String(key)} must be a number or null`);
}

function parseNullableInteger(
	body: Record<string, unknown>,
	key: keyof LibraryMetadataUpdateInput,
	options?: { min?: number; max?: number }
): number | null | undefined {
	if (!(key in body)) {
		return undefined;
	}
	const value = body[key];
	if (value === null) {
		return null;
	}
	if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) {
		if (options?.min !== undefined && value < options.min) {
			throw new Error(`${String(key)} must be at least ${options.min}`);
		}
		if (options?.max !== undefined && value > options.max) {
			throw new Error(`${String(key)} must be at most ${options.max}`);
		}
		return value;
	}
	throw new Error(`${String(key)} must be an integer or null`);
}

export function parseLibraryMetadataUpdateInput(body: unknown): LibraryMetadataUpdateInput {
	if (!isRecord(body)) {
		throw new Error('Body must be a JSON object');
	}

	for (const key of Object.keys(body)) {
		if (!allowedKeys.has(key as keyof LibraryMetadataUpdateInput)) {
			throw new Error(`Unknown field: ${key}`);
		}
	}

	const parsed: LibraryMetadataUpdateInput = {
		title: parseOptionalString(body, 'title'),
		author: parseNullableString(body, 'author'),
		publisher: parseNullableString(body, 'publisher'),
		series: parseNullableString(body, 'series'),
		volume: parseNullableString(body, 'volume'),
		seriesIndex: parseNullableNumber(body, 'seriesIndex', { min: 0 }),
		edition: parseNullableString(body, 'edition'),
		identifier: parseNullableString(body, 'identifier'),
		pages: parseNullableNumber(body, 'pages'),
		description: parseNullableString(body, 'description'),
		cover: parseNullableString(body, 'cover'),
		language: parseNullableString(body, 'language'),
		year: parseNullableInteger(body, 'year'),
		month: parseNullableInteger(body, 'month', { min: 1, max: 12 }),
		day: parseNullableInteger(body, 'day', { min: 1, max: 31 }),
		externalRating: parseNullableNumber(body, 'externalRating'),
		externalRatingCount: parseNullableNumber(body, 'externalRatingCount'),
		googleBooksId: parseNullableString(body, 'googleBooksId'),
		openLibraryKey: parseNullableString(body, 'openLibraryKey'),
		amazonAsin: parseNullableString(body, 'amazonAsin')
	};

	if (
		parsed.year !== undefined &&
		parsed.month !== undefined &&
		parsed.day !== undefined &&
		parsed.year !== null &&
		parsed.month !== null &&
		parsed.day !== null
	) {
		const publicationDateError = validatePublicationDateParts({
			year: parsed.year,
			month: parsed.month,
			day: parsed.day
		});
		if (publicationDateError) {
			throw new Error(publicationDateError);
		}
	}

	return parsed;
}
