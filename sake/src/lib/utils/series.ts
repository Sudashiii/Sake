export function parseSeriesIndex(value: string | number | null | undefined): number | null {
	if (typeof value === 'number') {
		return Number.isFinite(value) && value >= 0 ? value : null;
	}

	if (typeof value !== 'string') {
		return null;
	}

	const trimmed = value.trim();
	if (!trimmed || !/^\d+(?:\.\d+)?$/.test(trimmed)) {
		return null;
	}

	const parsed = Number(trimmed);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function resolveSeriesIndex(options: {
	seriesIndex: number | null | undefined;
	volume: string | null | undefined;
	fallbackSeriesIndex: number | null | undefined;
	fallbackVolume: string | null | undefined;
}): number | null {
	if (options.seriesIndex !== undefined) {
		return options.seriesIndex;
	}

	return (
		parseSeriesIndex(options.volume) ??
		options.fallbackSeriesIndex ??
		parseSeriesIndex(options.fallbackVolume)
	);
}
