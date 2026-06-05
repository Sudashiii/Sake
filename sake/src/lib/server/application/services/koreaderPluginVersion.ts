export type KoreaderPluginUpstreamStatus =
	| 'up_to_date'
	| 'outdated'
	| 'uploaded_newer'
	| 'unavailable';

export function parseKoreaderPluginMetaVersion(content: string): string | null {
	const match = content.match(/version\s*=\s*"([^"]+)"/);
	const version = match?.[1]?.trim();
	return version && version.length > 0 ? version : null;
}

export function compareKoreaderPluginVersions(left: string, right: string): number {
	const leftParts = left.match(/\d+/g)?.map((part) => Number.parseInt(part, 10)) ?? [];
	const rightParts = right.match(/\d+/g)?.map((part) => Number.parseInt(part, 10)) ?? [];
	const maxLength = Math.max(leftParts.length, rightParts.length);

	for (let index = 0; index < maxLength; index += 1) {
		const leftValue = leftParts[index] ?? 0;
		const rightValue = rightParts[index] ?? 0;
		if (leftValue !== rightValue) {
			return leftValue > rightValue ? 1 : -1;
		}
	}

	if (leftParts.length > 0 || rightParts.length > 0) {
		return 0;
	}

	return left.localeCompare(right);
}

export function getKoreaderPluginUpstreamStatus(
	uploadedVersion: string,
	upstreamVersion: string
): KoreaderPluginUpstreamStatus {
	const comparison = compareKoreaderPluginVersions(uploadedVersion, upstreamVersion);
	if (comparison === 0) {
		return 'up_to_date';
	}

	return comparison < 0 ? 'outdated' : 'uploaded_newer';
}
