import type { ZDownloadBookRequest } from '$lib/types/ZLibrary/Requests/ZDownloadBookRequest';
import { extractIsbn } from '$lib/utils/isbn';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRequiredString(body: Record<string, unknown>, key: keyof ZDownloadBookRequest): string {
	const value = body[key];
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(`${String(key)} is required`);
	}

	return value.trim();
}

function parseOptionalString(
	body: Record<string, unknown>,
	key: Exclude<keyof ZDownloadBookRequest, 'bookId' | 'hash' | 'title' | 'extension' | 'identifier'>
): string | null | undefined {
	if (!(key in body)) {
		return undefined;
	}

	const value = body[key];
	if (value === null) {
		return null;
	}
	if (typeof value !== 'string') {
		throw new Error(`${String(key)} must be a string or null`);
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function pickPreferredIdentifier(values: string[]): string | null {
	const extracted = values
		.map((value) => extractIsbn(value) ?? value)
		.filter((value) => value.trim().length > 0);
	if (extracted.length === 0) {
		return null;
	}

	const isbn13 = extracted.find((value) => /^\d{13}$/.test(value));
	if (isbn13) {
		return isbn13;
	}

	return extracted[0] ?? null;
}

function parseIdentifier(body: Record<string, unknown>): string | null | undefined {
	if (!('identifier' in body)) {
		return undefined;
	}

	const value = body.identifier;
	if (value === null) {
		return null;
	}
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}
	if (!Array.isArray(value)) {
		throw new Error('identifier must be a string, string array, or null');
	}

	const candidates = value.map((item) => {
		if (typeof item !== 'string') {
			throw new Error('identifier entries must be strings');
		}

		return item.trim();
	});

	return pickPreferredIdentifier(candidates);
}

function parseOptionalNumber(
	body: Record<string, unknown>,
	key: 'seriesIndex' | 'pages' | 'filesize' | 'year'
): number | null | undefined {
	if (!(key in body)) {
		return undefined;
	}

	const value = body[key];
	if (value === null) {
		return null;
	}
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Error(`${key} must be a number or null`);
	}

	return value;
}

function parseOptionalBoolean(
	body: Record<string, unknown>,
	key: 'upload' | 'downloadToDevice'
): boolean | undefined {
	if (!(key in body)) {
		return undefined;
	}

	const value = body[key];
	if (typeof value !== 'boolean') {
		throw new Error(`${key} must be a boolean`);
	}

	return value;
}

export function parseZDownloadBookRequest(raw: unknown): ZDownloadBookRequest {
	if (!isRecord(raw)) {
		throw new Error('Body must be a JSON object');
	}

	return {
		bookId: parseRequiredString(raw, 'bookId'),
		hash: parseRequiredString(raw, 'hash'),
		title: parseRequiredString(raw, 'title'),
		upload: parseOptionalBoolean(raw, 'upload') ?? false,
		extension: parseRequiredString(raw, 'extension'),
		author: parseOptionalString(raw, 'author') ?? undefined,
		publisher: parseOptionalString(raw, 'publisher') ?? undefined,
		series: parseOptionalString(raw, 'series') ?? undefined,
		volume: parseOptionalString(raw, 'volume') ?? undefined,
		seriesIndex: parseOptionalNumber(raw, 'seriesIndex') ?? undefined,
		edition: parseOptionalString(raw, 'edition') ?? undefined,
		identifier: parseIdentifier(raw) ?? undefined,
		pages: parseOptionalNumber(raw, 'pages') ?? undefined,
		description: parseOptionalString(raw, 'description') ?? undefined,
		cover: parseOptionalString(raw, 'cover') ?? undefined,
		filesize: parseOptionalNumber(raw, 'filesize') ?? undefined,
		language: parseOptionalString(raw, 'language') ?? undefined,
		year: parseOptionalNumber(raw, 'year') ?? undefined,
		downloadToDevice: parseOptionalBoolean(raw, 'downloadToDevice')
	};
}
