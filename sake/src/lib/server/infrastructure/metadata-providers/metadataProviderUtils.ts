import { parsePublicationDateString } from '$lib/utils/publicationDate';

export function asString(value: unknown): string | null {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function asPositiveNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export function asNonNegativeNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function pickFirstValue<T>(...values: Array<T | null | undefined>): T | null {
	for (const value of values) {
		if (value !== null && value !== undefined) {
			return value;
		}
	}
	return null;
}

export function parseProviderPublicationDate(value: string | null | undefined): {
	year: number | null;
	month: number | null;
	day: number | null;
} {
	return (
		parsePublicationDateString(value) ?? {
			year: null,
			month: null,
			day: null
		}
	);
}

export function normalizeForMatch(value: string | null | undefined): string {
	if (!value) {
		return '';
	}
	return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function languageTokens(input: string | null | undefined): string[] {
	if (!input) {
		return [];
	}

	const normalized = input.trim().toLowerCase();
	if (!normalized) {
		return [];
	}

	const mapped = new Set<string>();
	const add = (token: string) => mapped.add(token.toLowerCase());

	const mapByName: Record<string, string[]> = {
		english: ['en', 'eng'],
		german: ['de', 'deu', 'ger'],
		deutsch: ['de', 'deu', 'ger'],
		french: ['fr', 'fra', 'fre'],
		spanish: ['es', 'spa'],
		italian: ['it', 'ita'],
		portuguese: ['pt', 'por'],
		dutch: ['nl', 'nld', 'dut'],
		polish: ['pl', 'pol'],
		russian: ['ru', 'rus'],
		japanese: ['ja', 'jpn'],
		chinese: ['zh', 'zho', 'chi']
	};

	add(normalized);
	for (const token of normalized.split(/[^a-z0-9]+/g)) {
		if (token) {
			add(token);
		}
	}
	for (const token of mapByName[normalized] ?? []) {
		add(token);
	}

	return [...mapped];
}

function normalizeLanguageToken(value: string | null | undefined): string {
	if (!value) {
		return '';
	}

	const lower = value.toLowerCase().trim();
	if (!lower) {
		return '';
	}

	const parts = lower.split('/').filter(Boolean);
	return parts[parts.length - 1] ?? lower;
}

export function languageScore(
	targetLanguageTokens: string[],
	candidateLanguages: Array<string | null | undefined>
): number {
	if (targetLanguageTokens.length === 0) {
		return 0;
	}

	const normalizedCandidates = candidateLanguages
		.map((value) => normalizeLanguageToken(value))
		.filter((token) => token.length > 0);

	if (normalizedCandidates.length === 0) {
		return 0;
	}

	const matched = normalizedCandidates.some((token) => {
		if (targetLanguageTokens.includes(token)) {
			return true;
		}
		if (token.length >= 2 && targetLanguageTokens.includes(token.slice(0, 2))) {
			return true;
		}
		return false;
	});

	return matched ? 4 : -4;
}
