import { updateLibraryBookMetadataUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type MetadataUpdateInput = {
	title?: string;
	author?: string | null;
	publisher?: string | null;
	series?: string | null;
	volume?: string | null;
	edition?: string | null;
	identifier?: string | null;
	pages?: number | null;
	description?: string | null;
	cover?: string | null;
	language?: string | null;
	year?: number | null;
	externalRating?: number | null;
	externalRatingCount?: number | null;
	googleBooksId?: string | null;
	openLibraryKey?: string | null;
	amazonAsin?: string | null;
};

const allowedKeys = new Set<keyof MetadataUpdateInput>([
	'title',
	'author',
	'publisher',
	'series',
	'volume',
	'edition',
	'identifier',
	'pages',
	'description',
	'cover',
	'language',
	'year',
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
	key: keyof MetadataUpdateInput
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
	key: keyof MetadataUpdateInput
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
	key: keyof MetadataUpdateInput
): number | null | undefined {
	if (!(key in body)) {
		return undefined;
	}
	const value = body[key];
	if (value === null) {
		return null;
	}
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	throw new Error(`${String(key)} must be a number or null`);
}

function parseMetadataUpdateInput(body: unknown): MetadataUpdateInput {
	if (!isRecord(body)) {
		throw new Error('Body must be a JSON object');
	}

	for (const key of Object.keys(body)) {
		if (!allowedKeys.has(key as keyof MetadataUpdateInput)) {
			throw new Error(`Unknown field: ${key}`);
		}
	}

	return {
		title: parseOptionalString(body, 'title'),
		author: parseNullableString(body, 'author'),
		publisher: parseNullableString(body, 'publisher'),
		series: parseNullableString(body, 'series'),
		volume: parseNullableString(body, 'volume'),
		edition: parseNullableString(body, 'edition'),
		identifier: parseNullableString(body, 'identifier'),
		pages: parseNullableNumber(body, 'pages'),
		description: parseNullableString(body, 'description'),
		cover: parseNullableString(body, 'cover'),
		language: parseNullableString(body, 'language'),
		year: parseNullableNumber(body, 'year'),
		externalRating: parseNullableNumber(body, 'externalRating'),
		externalRatingCount: parseNullableNumber(body, 'externalRatingCount'),
		googleBooksId: parseNullableString(body, 'googleBooksId'),
		openLibraryKey: parseNullableString(body, 'openLibraryKey'),
		amazonAsin: parseNullableString(body, 'amazonAsin')
	};
}

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const requestLogger = getRequestLogger(locals);
	const id = Number(params.id);
	if (!Number.isFinite(id)) {
		return errorResponse('Invalid book id', 400);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch (err: unknown) {
		requestLogger.warn(
			{ event: 'library.metadata.update.invalid_json', error: toLogError(err), bookId: id },
			'Invalid JSON body'
		);
		return errorResponse('Invalid JSON body', 400);
	}

	let metadata: MetadataUpdateInput;
	try {
		metadata = parseMetadataUpdateInput(body);
	} catch (err: unknown) {
		requestLogger.warn(
			{ event: 'library.metadata.update.validation_failed', error: toLogError(err), bookId: id },
			'Metadata update validation failed'
		);
		return errorResponse(err instanceof Error ? err.message : 'Invalid metadata payload', 400);
	}

	try {
		const result = await updateLibraryBookMetadataUseCase.execute({
			bookId: id,
			metadata
		});
		if (!result.ok) {
			return errorResponse(result.error.message, result.error.status);
		}
		return json(result.value);
	} catch (err: unknown) {
		requestLogger.error(
			{ event: 'library.metadata.update.failed', error: toLogError(err), bookId: id },
			'Failed to update metadata'
		);
		return errorResponse('Failed to update metadata', 500);
	}
};
