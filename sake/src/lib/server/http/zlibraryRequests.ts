import type {
	ZLibraryPasswordLoginInput
} from '$lib/server/application/use-cases/ZLibraryPasswordLoginUseCase';
import type {
	ZLibrarySearchRequest
} from '$lib/server/application/ports/ZLibraryPort';
import type {
	ZLibraryTokenLoginInput
} from '$lib/server/application/use-cases/ZLibraryTokenLoginUseCase';

const MAX_CREDENTIAL_LENGTH = 1024;
const MAX_QUERY_LENGTH = 256;
const MAX_FILTER_VALUES = 20;
const MAX_FILTER_VALUE_LENGTH = 64;
const MAX_SEARCH_LIMIT = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRequiredString(raw: Record<string, unknown>, field: string, maxLength: number): string {
	const value = raw[field];
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(`${field} is required`);
	}
	if (value.length > maxLength) {
		throw new Error(`${field} is too long`);
	}
	return value.trim();
}

function parseStringArray(raw: Record<string, unknown>, field: string): string[] | undefined {
	const value = raw[field];
	if (value === undefined) {
		return undefined;
	}
	if (!Array.isArray(value) || value.length > MAX_FILTER_VALUES) {
		throw new Error(`${field} must be an array of at most ${MAX_FILTER_VALUES} strings`);
	}
	if (
		!value.every(
			(entry) =>
				typeof entry === 'string' &&
				entry.trim().length > 0 &&
				entry.length <= MAX_FILTER_VALUE_LENGTH
		)
	) {
		throw new Error(`${field} must contain non-empty strings of at most ${MAX_FILTER_VALUE_LENGTH} characters`);
	}
	return value.map((entry) => (entry as string).trim());
}

function parseYear(raw: Record<string, unknown>, field: string): string | undefined {
	const value = raw[field];
	if (value === undefined) {
		return undefined;
	}
	if (typeof value !== 'string' || !/^\d{1,4}$/.test(value)) {
		throw new Error(`${field} must be a year`);
	}
	return value;
}

export function parseZTokenLoginRequest(raw: unknown): ZLibraryTokenLoginInput {
	if (!isRecord(raw)) {
		throw new Error('Body must be a JSON object');
	}
	return {
		userId: parseRequiredString(raw, 'userId', MAX_CREDENTIAL_LENGTH),
		userKey: parseRequiredString(raw, 'userKey', MAX_CREDENTIAL_LENGTH)
	};
}

export function parseZPasswordLoginRequest(raw: unknown): ZLibraryPasswordLoginInput {
	if (!isRecord(raw)) {
		throw new Error('Body must be a JSON object');
	}
	return {
		email: parseRequiredString(raw, 'email', 320),
		password: parseRequiredString(raw, 'password', MAX_CREDENTIAL_LENGTH)
	};
}

export function parseZSearchRequest(raw: unknown): ZLibrarySearchRequest {
	if (!isRecord(raw)) {
		throw new Error('Body must be a JSON object');
	}

	const limit = raw.limit;
	if (
		limit !== undefined &&
		(typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > MAX_SEARCH_LIMIT)
	) {
		throw new Error(`limit must be an integer between 1 and ${MAX_SEARCH_LIMIT}`);
	}

	const order = raw.order;
	if (order !== undefined && order !== 'asc' && order !== 'desc') {
		throw new Error('order must be one of: asc, desc');
	}

	const searchText = parseRequiredString(raw, 'searchText', MAX_QUERY_LENGTH);
	const yearFrom = parseYear(raw, 'yearFrom');
	const yearTo = parseYear(raw, 'yearTo');
	const languages = parseStringArray(raw, 'languages');
	const extensions = parseStringArray(raw, 'extensions');

	return {
		searchText,
		...(yearFrom !== undefined ? { yearFrom } : {}),
		...(yearTo !== undefined ? { yearTo } : {}),
		...(languages !== undefined ? { languages } : {}),
		...(extensions !== undefined ? { extensions } : {}),
		...(order !== undefined ? { order } : {}),
		...(limit !== undefined ? { limit } : {})
	};
}
