export interface WebappVersion {
	version: string;
	gitTag: string | null;
	commitSha: string | null;
	releasedAt: string | null;
}

export interface WebappVersionInput {
	version?: string | null;
	gitTag?: string | null;
	commitSha?: string | null;
	releasedAt?: string | null;
}

function normalizeOptionalValue(value: string | null | undefined): string | null {
	if (typeof value !== 'string') {
		return null;
	}

	const normalized = value.trim();
	return normalized.length > 0 ? normalized : null;
}

export function createWebappVersion(input: WebappVersionInput): WebappVersion {
	return {
		version: normalizeOptionalValue(input.version) ?? 'dev-local',
		gitTag: normalizeOptionalValue(input.gitTag),
		commitSha: normalizeOptionalValue(input.commitSha),
		releasedAt: normalizeOptionalValue(input.releasedAt)
	};
}
