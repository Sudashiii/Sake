export interface PublicationDateParts {
	year: number | null;
	month: number | null;
	day: number | null;
}

function isIntegerInRange(value: number, min: number, max: number): boolean {
	return Number.isInteger(value) && value >= min && value <= max;
}

function hasTimestampLikeSuffix(value: string): boolean {
	return /[T\s]/.test(value);
}

export function validatePublicationDateParts(parts: PublicationDateParts): string | null {
	const { year, month, day } = parts;

	if (year !== null && !Number.isInteger(year)) {
		return 'year must be an integer or null';
	}
	if (month !== null && !isIntegerInRange(month, 1, 12)) {
		return 'month must be between 1 and 12';
	}
	if (day !== null && !isIntegerInRange(day, 1, 31)) {
		return 'day must be between 1 and 31';
	}
	if (month !== null && year === null) {
		return 'month requires year';
	}
	if (day !== null && (year === null || month === null)) {
		return 'day requires year and month';
	}
	if (year !== null && month !== null && day !== null) {
		const candidate = new Date(Date.UTC(2000, month - 1, day));
		candidate.setUTCFullYear(year);
		if (
			candidate.getUTCFullYear() !== year ||
			candidate.getUTCMonth() !== month - 1 ||
			candidate.getUTCDate() !== day
		) {
			return 'published date is not a valid calendar date';
		}
	}

	return null;
}

export function formatPublicationDate(parts: PublicationDateParts): string | null {
	const { year, month, day } = parts;
	if (year === null) {
		return null;
	}

	const formattedYear = String(year).padStart(4, '0');
	if (month === null) {
		return formattedYear;
	}

	const formattedMonth = String(month).padStart(2, '0');
	if (day === null) {
		return `${formattedYear}-${formattedMonth}`;
	}

	return `${formattedYear}-${formattedMonth}-${String(day).padStart(2, '0')}`;
}

function fallbackPublicationDate(year: number | null, month: number | null): PublicationDateParts | null {
	if (year === null) {
		return null;
	}
	if (month !== null && validatePublicationDateParts({ year, month, day: null }) === null) {
		return { year, month, day: null };
	}
	return { year, month: null, day: null };
}

export function parsePublicationDateString(value: string | null | undefined): PublicationDateParts | null {
	if (typeof value !== 'string') {
		return null;
	}

	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}

	const isoMatch = trimmed.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?(?:[T\s].*)?$/);
	if (isoMatch) {
		const year = Number.parseInt(isoMatch[1], 10);
		const month = isoMatch[2] ? Number.parseInt(isoMatch[2], 10) : null;
		const day = isoMatch[3] ? Number.parseInt(isoMatch[3], 10) : null;
		const parsed = { year, month, day };

		if (validatePublicationDateParts(parsed) === null) {
			return parsed;
		}

		return fallbackPublicationDate(year, month);
	}

	if (hasTimestampLikeSuffix(trimmed)) {
		const timestamp = Date.parse(trimmed);
		if (Number.isFinite(timestamp)) {
			const parsed = new Date(timestamp);
			return {
				year: parsed.getUTCFullYear(),
				month: parsed.getUTCMonth() + 1,
				day: parsed.getUTCDate()
			};
		}
	}

	const yearMatch = trimmed.match(/\b(1\d{3}|2\d{3})\b/);
	if (!yearMatch) {
		return null;
	}

	return {
		year: Number.parseInt(yearMatch[1], 10),
		month: null,
		day: null
	};
}
